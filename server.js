require('dotenv').config(); // MUST be at the very top
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = 3000;

// Use the secret variable from your .env file
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Successfully connected to MongoDB');
}).catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

// Mongoose Schema
const footprintSchema = new mongoose.Schema({
    electricityBill: Number,
    lpgCylinders: Number,
    carDistance: Number,
    domesticFlights: Number,
    internationalFlights: Number,
    totalFootprint: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Footprint = mongoose.model('Footprint', footprintSchema);

// --- API Endpoints ---

// POST: Save a new footprint calculation
app.post('/api/footprint', async(req, res) => {
    try {
        const footprintData = new Footprint(req.body);
        await footprintData.save();
        res.status(201).send({ message: 'Footprint data saved successfully.', data: footprintData });
    } catch (error) {
        res.status(400).send({ error: 'Failed to save footprint data.' });
    }
});

// GET: Fetch the last 5 footprint calculations for the history page
app.get('/api/history', async(req, res) => {
    try {
        const history = await Footprint.find()
            .sort({ createdAt: -1 }) // Get the newest ones first
            .limit(5); // Limit to 5 records
        res.status(200).send(history);
    } catch (error) {
        res.status(400).send({ error: 'Failed to fetch history data.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});