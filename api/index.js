const express = require("express");
const OpenAI = require('openai');
const axios = require('axios')
require('dotenv').config()
const app = express();
app.use(express.json());
const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

async function getCryptoDetails({
    symbol,
    time_end,
    time_start
}) {
    return axios.get(
        process.env.CMC_URL+'/v2/cryptocurrency/quotes/historical?symbol=' +
        symbol +
        '&time_start=' +
        time_start +
        '&time_end=' +
        time_end, {
            headers: {
                'X-CMC_PRO_API_KEY': process.env.CMC_KEY,
                Accept: 'application/json',
            },
        }
    ).then(({data}) => {
        if (!data?.status?.error_code) return data?.data?.[symbol]
        return null;
    });
}

async function get_crypto_price(params) {
    const data = await getCryptoDetails(params)
    return data.quotes.reduce((acc, curr) => acc + (curr.quote.USD.price / data.quotes.length), 0);
}

app.get('/ask', async (req, res) => {
    const query = req.query.query
    const runner = openai.beta.chat.completions.runTools({
        model: 'gpt-3.5-turbo',
        messages: [{
                role: 'system',
                content: 'Current time is '+new Date().toString(),
            },
            {
                role: 'user',
                content: query,
            },
        ],
        tools: [{
            type: 'function',
            function: {
                name: 'get_crypto_price',
                description: 'Fetches the historical price of a cryptocurrency for a specific date and time. Returns -1 if there is an error.',
                parameters: {
                    type: 'object',
                    properties: {
                        symbol: {
                            type: 'string',
                            description: 'The symbol of the cryptocurrency (e.g., BTC, ETH).',
                        },
                        time_start: {
                            type: 'string',
                            description: 'The starting date or time for which to fetch the price. Should be the time specified by the user (Unix or ISO 8601).',
                        },
                        time_end: {
                            type: 'string',
                            description: 'The ending date or time for which to fetch the price. SHould be more than the time specified by the user (Unix or ISO 8601).',
                        },
                    },
                    required: ['symbol', 'date'],
                },
                function: get_crypto_price,
                parse: JSON.parse,
            },
        }, ],
    });
    const result = await runner.finalChatCompletion()
    res.send(result.choices[0].message.content)

})
module.exports=app
app.listen(8000)