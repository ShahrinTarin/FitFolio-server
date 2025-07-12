require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4wteejr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db('fitFolio').collection('users')
    const trainersCollection = client.db('fitFolio').collection('trainers')
    const trainerApplicationsCollection = client.db('fitFolio').collection('trainerApplications')
    const classesCollection = client.db('fitFolio').collection('classes')
    const slotsCollection = client.db('fitFolio').collection('slots')
    const bookingsCollection = client.db('fitFolio').collection('bookings')
    const paymentsCollection = client.db('fitFolio').collection('payments')
    const forumsCollection = client.db('fitFolio').collection('forums')
    const reviewsCollection = client.db('fitFolio').collection('reviews')
    const newsletterSubscribersCollection = client.db('fitFolio').collection('newsletterSubscribers')


    // POST /api/auth/register
    app.post("/register", async (req, res) => {
      const { name, email, photoURL } = req.body;
      try {
        const db = client.db("fitfolio"); // replace with your DB name
        const usersCollection = db.collection("users");

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ message: "User already exists" });
        }

        const newUser = {
          name,
          email,
          photoURL,
          role: "member",
          createdAt: new Date(),
        };

        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "User registered", user: newUser });
      } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: "Registration error", error: error.message });
      }
    });



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('FitFolio is running')
})

app.listen(port, () => {
  console.log(`FitFolio server is running on ${port}`);
})
