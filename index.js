const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin"); //Tokener code eta
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const cors = require('cors');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// doctors-firebase-adminsdk.json

//Token er code
const serviceAccount = require('./doctors-firebase-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// nicher 2 ta jinis obossoi lagbe front-end theke data recicve korar jonno
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gbhkw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri);

// async function varifyToken(req, res, next) {
//     if (req.headers?.authorization?.stratsWith('Bearer ')) {
//         const token = req.headers.authorization.split(' ')[1];

//         try {
//             const decodedUser = await admin.auth().verifyIdToken(token);
//             req.decodedEmail = decodedUser.email;
//         }
//         catch {

//         }
//     }
//     next();
// }
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}


async function run() {
    try {
        await client.connect();
        console.log('Connected to database');
        const database = client.db('doctors_portal');
        const appoinmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        //Recive data from Appointments
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            // console.log(appointment);
            const result = await appoinmentsCollection.insertOne(appointment);
            res.json(result);
        });
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;
            // console.log("hitting with =", email);
            // console.log(date);
            const query = { email: email, date: date };
            const cursor = appoinmentsCollection.find(query);
            const appointments = await cursor.toArray();
            // console.log(appointments);
            res.json(appointments)
        });
        //users data store
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            // console.log(result);
            res.json(result);

        })
        // user data store for Google Sign In
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            // console.log(result);
            res.json(result);


        })
        //Admin Making
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            // console.log('put for ', req.headers.authorization);
            // console.log('Decoded Emai:', req.decodedEmail);
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ messasge: "You are not permittied to make anyone admin" });
            }

            // console.log(result);
        });
        // Search Admin
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })
        // search appointment by ID 
        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await appoinmentsCollection.findOne(query);
            res.json(result);
        })

        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            });
            res.json({ clientSecret: paymentIntent.client_secret })

        })
    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log('lisiting to port', port)
})
