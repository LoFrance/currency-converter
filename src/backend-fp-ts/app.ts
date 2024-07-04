import * as T from 'fp-ts/lib/Task';
import * as TE from 'fp-ts/lib/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import express, { Request, Response } from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { toError } from 'fp-ts/lib/Either';
const dotenv = require('dotenv').config();

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

const handler = (
  { body }: Request,
  res: Response
): Promise<Response<Express.CustomErrorResponse, Express.CustomResponse>> => {
  console.log(body);
  const resultPipe = pipe(
    TE.tryCatch(
      () =>
        axios({
          baseURL: `${BASE_API_URL}/${API_KEY}/pair/${body.from}/${body.to}/${body.amount}`,
          method: 'get',
          timeout: 1000,
          headers: { 'X-Custom-Header': 'foobar' }
        }),
      e =>
        res.json({
          message: `Error converting currency`,
          details: toError(e).message
        }) as Response<Express.CustomErrorResponse, Express.CustomResponse>
    ),
    check => check, // check: TE.TaskEither<express.Response<Express.CustomErrorResponse, Express.CustomResponse>, AxiosResponse<any, any>>
    TE.chain(response =>
      pipe(
        response,
        TE.fromPredicate(
          response => response.data && response.data.result === 'success',
          response =>
            res.json({
              message: 'Error converting currency',
              details: response
            }) as Response<Express.CustomErrorResponse, Express.CustomResponse>
        ),
        check => check, // check: TE.TaskEither<express.Response<Express.CustomErrorResponse, Express.CustomResponse>, AxiosResponse<any, any>>
        TE.map(
          _ =>
            res.json({
              base: body.from,
              target: body.to,
              conversionRate: response.data.conversion_rate,
              convertedAmount: response.data.conversion_result
            }) as Response<Express.CustomErrorResponse, Express.CustomResponse>
        ),
        check => check // check: TE.TaskEither<express.Response<Express.CustomErrorResponse, Express.CustomResponse>, express.Response<Express.CustomErrorResponse, Express.CustomResponse>>
      )
    ),
    check => check, // check: TE.TaskEither<express.Response<Express.CustomErrorResponse, Express.CustomResponse>, express.Response<Express.CustomErrorResponse, Express.CustomResponse>>
    TE.toUnion,
    check => check // check: Task<express.Response<Express.CustomErrorResponse, Express.CustomResponse>>
  )();
  // con (); Promise<express.Response<Express.CustomErrorResponse, Express.CustomResponse>>
  // senza (): Task<Response<CustomErrorResponse, CustomResponse>>
  return resultPipe;
};

/*
TE.toUnion + (): mi torna  => Promise<....>
TE.toUnion: mi torna => Task<...>
senza TE.toUnion ma con () mi torna => Promise<Either<...>>
senza TE.toUnion e senza () mi torna => TE.TaskEither<..>

Il TE.toUnion passo da un TE.TaskEither ad un Task
Eseguendo la funzione con () passo da un Task ad una Promise

Se uso TE.fold => faccio T.of di entrambi
TE.fold(
  T.of,
  T.of
),
cioè passo da un TE ad un T ed eseguendo () ho una Promise

*/

app.post('/api/convert', handler);

app.listen(PORT, () => console.log(`Server is up on ${PORT}`));
