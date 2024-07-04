import { Effect, pipe } from 'effect';

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Schema } from '@effect/schema';

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

const handler = ({ body }: Request, res: Response): any => {
  const callToApi = pipe(
    Effect.tryPromise({
      try: () =>
        fetch(
          `${BASE_API_URL}/${API_KEY}/pair/${body.from}/${body.to}/${body.amount}`
        ).then(r => r.json()),
      catch: () =>
        res.json({
          message: 'Errore',
          details: `Errore nella fase di recupero dati dall'API`
        })
    }),
    Effect.flatMap(unknownData => Schema.decodeUnknown(ApiSchema)(unknownData)),
    Effect.flatMap(decodedData =>
      decodedData.result === 'success'
        ? Effect.succeed(decodedData)
        : Effect.fail(
            res.json({
              message: 'Chiamata fallita',
              details: `Risposta dal server ${JSON.stringify(decodedData)}`
            })
          )
    ),
    Effect.map(decodedData =>
      res.json({
        result: decodedData.result,
        base: decodedData.base_code,
        target: decodedData.target_code,
        conversionRate: decodedData.conversion_rate,
        convertedAmount: decodedData.conversion_result
      })
    )
  );
  return Effect.runPromise(callToApi);
};

app.post('/api/convert', handler);

app.listen(PORT, () => console.log(`Server is up on ${PORT}`));
