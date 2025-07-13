require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
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



const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'Unauthorized Access!' })
    }
     req.decoded = decoded;
    next()
  })
}



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


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email }
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

    const verifyTrainer= async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email }
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== 'trainer') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }


    // get a user's role
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      if (!result) return res.status(404).send({ message: 'User Not Found.' })
      res.send({ role: result?.role })
    })



    // generate jwt
    app.post('/jwt', (req, res) => {
      const user = { email: req.body.email }
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: '7d'
      })
      res.send({ token, message: 'jwt created successfully' })
    })


    // POST /api/auth/register
    app.post("/register", async (req, res) => {
      const { name, email, photoURL } = req.body;
      try {
        const userEmail = email.toLowerCase();
        const existingUser = await usersCollection.findOne({ email: userEmail });

        const newUser = {
          name,
          email: userEmail,
          photoURL,
          role: "member",
          createdAt: new Date().toISOString(),
          last_loggedin: new Date().toISOString(),
        };


        if (existingUser) {
          // Update last login time if user exists
          await usersCollection.updateOne(
            { email: userEmail },
            { $set: { last_loggedin: new Date().toISOString() } }
          );
          return res.status(200).send({ message: 'User already exists', user: existingUser });
        }


        const result = await usersCollection.insertOne(newUser);
        res.status(201).send({ message: "User registered", user: newUser });
      } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).send({ message: "Registration error", error: error.message });
      }
    });



    app.post('/social-login', async (req, res) => {
      try {
        const { name, email, photoURL } = req.body;

        if (!email) {
          return res.status(400).send({ message: 'Email is required' });
        }

        const userEmail = email.toLowerCase();
        const existingUser = await usersCollection.findOne({ email: userEmail });

        // New user
        const newUser = {
          name,
          email: userEmail,
          photoURL,
          role: 'member',
          createdAt: new Date().toISOString(),
          last_loggedin: new Date().toISOString(),
        };

        if (existingUser) {
          // Update last login time if user exists
          await usersCollection.updateOne(
            { email: userEmail },
            { $set: { last_loggedin: new Date().toISOString() } }
          );
          return res.status(200).send({ message: 'User already exists', user: existingUser });
        }



        const insertResult = await usersCollection.insertOne(newUser);

        if (insertResult.insertedId) {
          return res.status(201).send({ message: 'User created successfully', user: newUser });
        } else {
          throw new Error('Failed to create user');
        }
      } catch (error) {
        console.error('Error in /social-login:', error);
        res.status(500).send({ message: 'Internal server error', error: error.message });
      }
    });





    // json a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.json('FitFolio is running')
})

app.listen(port, () => {
  console.log(`FitFolio server is running on ${port}`);
})
