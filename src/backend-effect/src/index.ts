import { Effect, Either, pipe } from 'effect';

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Schema } from '@effect/schema';
import { FiberFailure } from 'effect/Runtime';

const PORT = process.env.PORT || 5005;
const app = express();

const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const BASE_API_URL = `https://v6.exchangerate-api.com/v6`;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit 100 request per window
});

// Cors options
const corsOptions = {
  origin: ['http://localhost:5173']
};
// Middleware
app.use(express.json());
app.use(apiLimiter);
app.use(cors(corsOptions));

const ApiSchema = Schema.Struct({
  result: Schema.String,
  base_code: Schema.String,
  target_code: Schema.String,
  conversion_rate: Schema.Number,
  conversion_result: Schema.Number
});
type ApiResponse = Schema.Schema.Type<typeof ApiSchema>;

const fetchData = ({ body }: Request, res: Response) =>
  Effect.tryPromise({
    try: () =>
      fetch(
        `${BASE_API_URL}/${API_KEY}/pair/${body.from}/${body.to}/${body.amount}`
      ).then(res => res.json()),
    catch: () => ({
      message: 'Errore',
      details: `Errore nella fase di recupero dati dall'API`
    })
  });

const decodeData = (unknownData: any) => {
  const resDecode = Schema.decodeEither(ApiSchema)(unknownData);
  return Either.isLeft(resDecode)
    ? Effect.fail({ message: 'Fail to decode' })
    : Effect.succeed(resDecode);
};

const sendData = (
  decodedData: Effect.Effect<ApiResponse, { message: string }>
) =>
  pipe(
    decodedData,
    Effect.flatMap(a =>
      a.result === 'success'
        ? Effect.succeed(a)
        : Effect.fail({
            message: 'Chiamata fallita',
            details: `Risposta dal server ${JSON.stringify(decodedData)}`
          })
    )
  );

const handler = (req: Request, res: Response) => {
  const program = Effect.gen(function* () {
    const fetchedData = yield* fetchData(req, res);
    const data = yield* decodeData(fetchedData);
    return yield* sendData(data);
  });
  return Effect.runPromise(program)
    .then(a => res.json(a))
    .catch((e: FiberFailure) => res.json(JSON.parse(e.message)));
};

app.post('/api/convert', handler);

app.listen(PORT, () => console.log(`Server is up on ${PORT}`));
