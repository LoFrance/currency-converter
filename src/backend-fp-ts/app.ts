import * as TE from 'fp-ts/lib/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import express from 'express';
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
  data: { from: string; to: string; amount: number },
  res: express.Response
) =>
  pipe(
    TE.tryCatch(
      () =>
        axios<{ data: any }, { data: any }>({
          baseURL: `${BASE_API_URL}/${API_KEY}/pair/${data.from}/${data.to}/${data.amount}`,
          method: 'get',
          timeout: 1000,
          headers: { 'X-Custom-Header': 'foobar' }
        }),
      e => {
        console.log(e);
        res.json({
          message: `Error converting currency`,
          details: toError(e).message
        });
      }
    ),
    TE.chain(response =>
      pipe(
        response,
        TE.fromPredicate(
          response => response.data && response.data.result === 'success',
          response => {
            console.log(response);
            res.json({
              message: 'Error converting currency',
              details: response
            });
          }
        ),
        TE.map(_ =>
          res.json({
            base: data.from,
            target: data.to,
            conversionRate: response.data.conversion_rate,
            convertedAmount: response.data.conversion_result
          })
        )
      )
    ),
    TE.toUnion
  )();

app.post('/api/convert', async (req, res) =>
  handler(
    { from: req.body.from, to: req.body.to, amount: req.body.amount },
    res
  )
);

app.listen(PORT, () => console.log(`Server is up on ${PORT}`));
