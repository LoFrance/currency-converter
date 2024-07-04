const dotenv = require('dotenv').config();
const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
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

// Routing
app.post('/api/convert', async (req, res) => {
  try {
    const { from, to, amount } = req.body;
    console.log(from, to, amount);

    const response = await axios({
      baseURL: `${BASE_API_URL}/${API_KEY}/pair/${from}/${to}/${amount}`,
      method: 'get',
      timeout: 1000,
      headers: { 'X-Custom-Header': 'foobar' }
    });
    if (response.data && response.data.result === 'success') {
      res.json({
        base: from,
        target: to,
        conversionRate: response.data.conversion_rate,
        convertedAmount: response.data.conversion_result
      });
    } else {
      res.json({
        message: 'Error converting currency',
        details: response.data
      });
    }
  } catch (error) {
    res.json({ message: 'Error converting currency', details: error.message });
  }
});

// Server
app.listen(PORT, console.log(`Server is up on ${PORT}`));
