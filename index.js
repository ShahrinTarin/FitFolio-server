require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5174',
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
    // const slotsCollection = client.db('fitFolio').collection('slots')
    // const bookingsCollection = client.db('fitFolio').collection('bookings')
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

    const verifyTrainer = async (req, res, next) => {
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



    // Combined Activity Log: Pending (from trainerApplications) + Rejected (from trainers)
    app.get('/trainer/applications/activity-log', verifyJWT, async (req, res) => {
      try {
        // 1. Get pending applications from trainerApplicationsCollection
        const pending = await trainerApplicationsCollection
          .find({ status: 'pending' })
          .project({ fullName: 1, email: 1, status: 1, appliedAt: 1 })
          .toArray();

        // 2. Get rejected trainers from trainersCollection (includes feedback)
        const rejected = await trainerApplicationsCollection
          .find({ status: 'rejected' })
          .project({ fullName: 1, email: 1, status: 1, feedback: 1, rejectedAt: 1 })
          .toArray();

        const combined = [...pending, ...rejected];
        res.status(200).send(combined);
      } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).send({ message: 'Failed to fetch activity log', error: error.message });
      }
    });





    // Get all trainer applications (Admin only)
    app.get('/trainer/applications', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        // only fetch pending applications
        const applications = await trainerApplicationsCollection.find({ status: 'pending' }).toArray();
        res.status(200).send(applications);
      } catch (error) {
        console.error('Failed to fetch trainer applications:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });


    // GET: Approved trainers only (Public)
    app.get('/trainers/approved', async (req, res) => {
      try {
        const approvedTrainers = await trainersCollection.find({ status: 'approved' }).toArray();
        res.status(200).send(approvedTrainers);
      } catch (error) {
        console.error('Error fetching approved trainers:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });


    app.get('/trainerdetails/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const trainer = await trainersCollection.findOne({ _id: new ObjectId(id) });
        if (!trainer) return res.status(404).send({ message: 'Trainer not found' });
        res.send(trainer);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching trainer', error: error.message });
      }
    });




    // GET: All trainers
    app.get('/users/trainers', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const trainers = await usersCollection.find({ role: 'trainer' }).toArray();
        res.status(200).send(trainers);
      } catch (err) {
        res.status(500).send({ message: 'Failed to fetch trainers', error: err.message });
      }
    });



    // GET all newsletter subscribers (Admin only)
    app.get('/newsletter/all', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const subscribers = await newsletterSubscribersCollection.find().toArray();
        res.status(200).send(subscribers);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch subscribers', error: err.message });
      }
    });



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


    // Apply to be a Trainer
    app.post('/trainer/apply', verifyJWT, async (req, res) => {
      try {
        const application = req.body;

        // Add backend-controlled fields
        application.status = 'pending';
        application.appliedAt = new Date().toISOString();

        // Prevent duplicate applications for the same email
        const alreadyApplied = await trainerApplicationsCollection.findOne({ email: application.email });
        if (alreadyApplied) {
          return res.status(400).send({ message: 'Already applied!' });
        }

        const result = await trainerApplicationsCollection.insertOne(application);
        res.status(201).send({ message: 'Application submitted', result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to apply', error: err.message });
      }
    });



    // POST /newsletter/subscribe
    app.post('/newsletter/subscribe', async (req, res) => {
      try {
        const { name, email } = req.body;

        if (!name || !email) {
          return res.status(400).send({ message: "Name and Email are required." });
        }

        const existing = await newsletterSubscribersCollection.findOne({ email: email.toLowerCase() });

        if (existing) {
          return res.status(409).send({ message: "You are already subscribed." });
        }

        const subscriber = {
          name,
          email: email.toLowerCase(),
          subscribedAt: new Date().toISOString(),
        };

        const result = await newsletterSubscribersCollection.insertOne(subscriber);

        if (result.insertedId) {
          res.status(201).send({ message: "Subscription successful!" });
        } else {
          res.status(500).send({ message: "Failed to subscribe. Please try again." });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });



    // POST /classes - Add a new class (Admin only)
    app.post('/classes', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const { name, image, details, extraInfo } = req.body;

        if (!name || !image || !details) {
          return res.status(400).json({ message: 'Name, image, and details are required' });
        }

        const newClass = {
          name,
          image,
          details,
          extraInfo: extraInfo || '',
          bookingCount: 0,  // initialize booking count to zero
          createdAt: new Date().toISOString(),
        };

        const result = await classesCollection.insertOne(newClass);

        if (result.insertedId) {
          res.status(201).json({ message: 'Class created successfully', insertedId: result.insertedId });
        } else {
          res.status(500).json({ message: 'Failed to create class' });
        }
      } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
      }
    });



    // PATCH /trainer/applications/:id/approve
    app.patch('/trainer/applications/:id/approve', verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;

      try {
        const filter = { _id: new ObjectId(id) };

        // 1. Update application status
        const updateResult = await trainerApplicationsCollection.updateOne(filter, {
          $set: { status: 'approved' },
        });

        // 2. Get the application details
        const application = await trainerApplicationsCollection.findOne(filter);

        // 3. Promote user to trainer role
        if (application?.email) {
          await usersCollection.updateOne(
            { email: application.email },
            { $set: { role: 'trainer' } }
          );
        }

        // 4. Insert into trainers collection
        const alreadyExists = await trainersCollection.findOne({ email: application.email });
        if (!alreadyExists) {

          const trainerData = {
            fullName: application.fullName || '',
            email: application.email || '',
            age: parseInt(application.age) || 0,
            experience: parseInt(application.experience) || 0,
            profileImage: application.profileImage || '',
            skills: Array.isArray(application.skills) ? application.skills : [],
            availableDays: Array.isArray(application.availableDays) ? application.availableDays : [],
            availableTime: application.availableTime || '',
            otherInfo: application.otherInfo || '',
            facebook: application.facebook || '',
            linkedin: application.linkedin || '',
            status: 'approved',
            appliedAt: application.appliedAt || new Date().toISOString(),
          };

          await trainersCollection.insertOne(trainerData);
        }

        res.status(200).send({ message: 'Trainer approved', updateResult });
      } catch (err) {
        console.error('Approve Error:', err);
        res.status(500).send({ message: 'Failed to approve', error: err.message });
      }
    });



    // PATCH /trainer/applications/:id/reject
    app.patch('/trainer/applications/:id/reject', verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const { feedback } = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: 'rejected',
            feedback: feedback || '',
            rejectedAt: new Date().toISOString(),
          },
        };

        const result = await trainerApplicationsCollection.updateOne(filter, update);

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: 'Application not found or already rejected.' });
        }

        res.status(200).send({ message: 'Application rejected successfully', result });
      } catch (err) {
        console.error('Reject Error:', err);
        res.status(500).send({ message: 'Failed to reject application', error: err.message });
      }
    });




    // Remove Trainer Role and Delete from Trainers Collection
    app.patch('/users/remove-trainer/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;

      try {
        // 1. Find the user by ID
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if (!user) return res.status(404).send({ message: 'User not found' });

        // 2. Update user role to 'member'
        const userUpdate = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: 'member' } }
        );

        // 3. Delete from trainers collection using email
        const trainerDelete = await trainerApplicationsCollection.deleteOne({ email: user.email });

        res.status(200).send({
          message: 'Trainer role removed and trainer deleted successfully.',
          userUpdate,
          trainerDelete,
        });
      } catch (err) {
        console.error('Remove Trainer Error:', err);
        res.status(500).send({ message: 'Failed to remove trainer', error: err.message });
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
