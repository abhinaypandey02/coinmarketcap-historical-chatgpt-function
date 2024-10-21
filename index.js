import express from "express";
import OpenAI from 'openai';
import 'dotenv/config'
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
    return fetch(
        process.env.CMC_URL +
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
    ).then((res) => res.json()).then(data => {
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
                content: '',
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
                            description: 'The starting date or time for which to fetch the price. Should be less than time_end (Unix or ISO 8601).',
                        },
                        time_end: {
                            type: 'string',
                            description: 'The ending date or time for which to fetch the price. SHould be more than time_start (Unix or ISO 8601).',
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
export default app
app.listen(8000)