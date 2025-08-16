require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SK_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://fitfolio-by-shahrin.web.app'],
  credentials: true,
  optionSuccessStatus: 200,
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


    const verifyAdminOrTrainer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });
      if (!user || (user.role !== 'admin' && user.role !== 'trainer')) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };



    app.get('/forums/latest', async (req, res) => {
      try {
        const latestPosts = await forumsCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(6)
          .project({
            _id: 1,
            title: 1,
            image: 1,
            category: 1,
            description: 1,
            createdAt: 1
          })
          .toArray();

        res.status(200).json(latestPosts);
      } catch (error) {
        console.error('Error fetching latest forum posts:', error);
        res.status(500).json({ message: 'Failed to fetch latest forum posts' });
      }
    });





    app.get('/admin/booking-summary', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const payments = await bookingsCollection.find().sort({ createdAt: -1 }).toArray();
        const totalBalance = payments.reduce((sum, p) => sum + p.price, 0);
        const lastSixTransactions = payments.slice(0, 6);
        res.send({ totalBalance, lastSixTransactions });
      } catch (error) {
        res.status(500).send({ message: 'Failed to load balance summary' });
      }
    });



    app.get('/reviews', async (req, res) => {
      try {
        const reviews = await reviewsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).send(reviews);
      } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });




    // GET all classes (public)
    app.get('/classes', async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.status(200).send(classes);
      } catch (error) {
        console.error('Failed to fetch classes:', error);
        res.status(500).send({ message: 'Internal server error', error: error.message });
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


    app.get('/admin/overview-counts', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        // Get subscriber count (optimized)
        const subscriberCount = await newsletterSubscribersCollection.countDocuments({});

        // Get unique paying members (using aggregation for better performance)
        const memberCountResult = await bookingsCollection.aggregate([
          {
            $group: {
              _id: "$userEmail",
              count: { $sum: 1 }
            }
          },
          {
            $count: "totalMembers"
          }
        ]).toArray();

        const memberCount = memberCountResult[0]?.totalMembers || 0;

        res.send({
          subscriberCount,
          memberCount
        });

      } catch (error) {
        console.error('Error in /admin/overview-counts:', {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });

        res.status(500).send({
          success: false,
          message: 'Failed to load statistics data',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    });


    // get a user's role
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      if (!result) return res.status(404).send({ message: 'User Not Found.' })
      res.send({ role: result?.role })
    })



    // GET /trainers/featured
    app.get('/trainers/featured', async (req, res) => {
      try {
        const trainers = await trainersCollection
          .find({ status: 'approved' })
          .limit(3)
          .toArray();
        res.send(trainers);
      } catch (error) {
        console.error('Error fetching featured trainers:', error);
        res.status(500).send({ message: 'Failed to fetch trainers' });
      }
    });



  
    app.get('/trainers-by-class/:className', async (req, res) => {
      const className = req.params.className;

      try {
        const trainers = await trainersCollection
          .find({
            skills: className,
            status: 'approved'
          })
          .project({
            _id: 1,
            fullName: 1,
            profileImage: 1
          })
          .limit(5)
          .toArray();

        res.send(trainers);
      } catch (error) {
        console.error('Error fetching trainers by class:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });


    // GET /class?page=1&limit=6&search=keyword&sort=asc|desc
    app.get('/class', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const sort = req.query.sort || ''; // asc | desc

        // Build query object
        let query = {};
        if (search) {
          query = { name: { $regex: search, $options: 'i' } };
        }

        // Build sort object
        let sortQuery = {};
        if (sort === 'asc') sortQuery = { bookingCount: 1 };
        if (sort === 'desc') sortQuery = { bookingCount: -1 };

        // Get total count
        const total = await classesCollection.countDocuments(query);

        // Get classes
        const classes = await classesCollection.find(query)
          .sort(sortQuery)   // apply sorting
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({ classes, total });
      } catch (err) {
        res.status(500).send({ message: "Failed to load classes", error: err.message });
      }
    });




    //  Example Express route for featured classes
    app.get('/classes/featured', async (req, res) => {
      try {
        const featuredClasses = await classesCollection
          .find({})
          .sort({ bookingCount: -1 })
          .limit(6)
          .toArray();

        res.status(200).send(featuredClasses);
      } catch (error) {
        console.error('Error fetching featured classes:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });






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


    app.get('/slots/trainers/:email', async (req, res) => {
      const trainerEmail = req.params.email;
      try {
        // Find slots with matching trainerEmail AND isBooked === false
        const slots = await slotsCollection.find({ trainerEmail, isBooked: false }).toArray();
        res.status(200).send(slots);
      } catch (error) {
        console.error('Failed to fetch slots:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });


    // Get bookings for a logged-in user
    app.get('/bookings', verifyJWT, async (req, res) => {
      try {
        const userEmail = req.decoded.email;
        const bookings = await bookingsCollection.find({ userEmail }).toArray();
        res.status(200).send(bookings);
      } catch (error) {
        console.error('Failed to fetch bookings:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });



    app.get('/slots/:trainerEmail', verifyJWT, verifyTrainer, async (req, res) => {
      const { trainerEmail } = req.params;
      const slots = await slotsCollection.find({ trainerEmail }).toArray();
      res.send(slots);
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


    app.get('/trainer/details/:email', verifyJWT, verifyTrainer, async (req, res) => {
      const email = req.params.email;
      try {
        const trainer = await trainersCollection.findOne({ email });
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


    // Get single forum post by ID
    app.get('/forums/:id', verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const post = await forumsCollection.findOne({ _id: new ObjectId(id) });

        if (!post) {
          return res.status(404).send({ message: 'Forum post not found' });
        }

        res.status(200).send(post);
      } catch (error) {
        console.error('Error fetching forum post:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });




    // Pagination GET /forums now
    app.get('/forums', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        // Aggregate to join user role info by authorEmail
        const forumsCursor = forumsCollection.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'authorEmail',
              foreignField: 'email',
              as: 'authorInfo'
            }
          },
          { $unwind: { path: '$authorInfo' } },
          {
            $addFields: {
              authorRole: '$authorInfo.role'
            }
          },
          {
            $project: { authorInfo: 0 }
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit }
        ]);

        const posts = await forumsCursor.toArray();
        const totalPosts = await forumsCollection.countDocuments();

        res.status(200).send({
          posts,
          pagination: {
            page,
            pages: Math.ceil(totalPosts / limit),
            total: totalPosts,
          },
        });
      } catch (error) {
        console.error('Failed to fetch forums:', error);
        res.status(500).send({ message: 'Failed to fetch forum posts' });
      }
    });



    // Vote POST /forums/:id/vote now 
    app.post('/forums/:id/vote', verifyJWT, async (req, res) => {
      try {
        const forumId = req.params.id;
        const userEmail = req.decoded.email;
        const vote = req.body.vote;

        if (![1, -1].includes(vote)) {
          return res.status(400).send({ message: 'Vote must be 1 or -1' });
        }

        const forumPost = await forumsCollection.findOne({ _id: new ObjectId(forumId) });
        if (!forumPost) {
          return res.status(404).send({ message: 'Forum post not found' });
        }

        // Find author user info to check role
        const authorEmail = forumPost.authorEmail;
        const authorUser = await usersCollection.findOne({ email: authorEmail });

        if (!authorUser) {
          return res.status(404).send({ message: 'Author user not found' });
        }


        const currentVotes = forumPost.votes || { up: 0, down: 0, voters: {} };

        const prevVote = currentVotes.voters ? currentVotes.voters[userEmail] : undefined;

        if (prevVote === vote) {
          return res.status(400).send({ message: 'You already voted this way' });
        }

        // Calculate increments
        let upInc = 0;
        let downInc = 0;

        if (prevVote === undefined) {
          // New vote
          if (vote === 1) upInc = 1;
          else downInc = 1;
        } else {
          // User changed vote, adjust counts accordingly
          if (vote === 1) {
            upInc = 1;
            downInc = -1;
          } else {
            upInc = -1;
            downInc = 1;
          }
        }

        // Update voters map
        const voters = { ...currentVotes.voters, [userEmail]: vote };

        // Update in DB
        await forumsCollection.updateOne(
          { _id: new ObjectId(forumId) },
          {
            $set: { 'votes.voters': voters },
            $inc: { 'votes.up': upInc, 'votes.down': downInc }
          }
        );

        res.status(200).send({ message: 'Vote recorded' });

      } catch (error) {
        console.error('Voting error:', error);
        res.status(500).send({ message: 'Failed to record vote' });
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





    app.post('/forums', verifyJWT, verifyAdminOrTrainer, async (req, res) => {
      try {
        const { title, image, category, description, createdAt } = req.body;

        // validation
        if (!title || !description || !category) {
          return res.status(400).send({ message: 'Title, category, and description are required.' });
        }

        const newForumPost = {
          title: title.trim(),
          image: image?.trim() || '',
          category,
          description: description.trim(),
          createdAt: createdAt || new Date().toISOString(),
          votes: { up: 0, down: 0 },
          authorEmail: req.decoded.email || null,
        };

        const result = await forumsCollection.insertOne(newForumPost);

        res.status(201).send({ message: 'Forum post added successfully', postId: result.insertedId });
      } catch (err) {
        console.error('Failed to add forum post:', err);
        res.status(500).send({ message: 'Failed to add forum post', error: err.message });
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
            slotName: application.slotName || '',
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


    // POST a new review
    app.post('/reviews', verifyJWT, async (req, res) => {
      try {
        const reviewData = req.body;

        // Validate required fields
        if (!reviewData.bookingId || !reviewData.userEmail || !reviewData.rating || !reviewData.feedback) {
          return res.status(400).send({ message: 'Missing required review fields' });
        }


        const review = {
          bookingId: new ObjectId(reviewData.bookingId),
          userEmail: reviewData.userEmail,
          userphoto: reviewData.userphoto,
          userName: reviewData.userName,
          rating: reviewData.rating,
          feedback: reviewData.feedback,
          createdAt: new Date().toISOString(),
          additionalFields: reviewData.additionalFields || {},
        };

        const result = await reviewsCollection.insertOne(review);

        if (result.insertedId) {
          res.status(201).send({ message: 'Review submitted successfully', insertedId: result.insertedId });
        } else {
          res.status(500).send({ message: 'Failed to submit review' });
        }
      } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });



    app.post('/add-slot', verifyJWT, verifyTrainer, async (req, res) => {
      try {
        const { email, slotName, slotTime, days, classId, otherInfo } = req.body;

        if (!email || !slotName || !slotTime || !days?.length || !classId) {
          return res.status(400).send({ message: 'Missing required fields.' });
        }

        // Get trainer details
        const trainer = await trainersCollection.findOne({ email });
        if (!trainer) {
          return res.status(404).send({ message: 'Trainer not found' });
        }

        // Get class details
        const classData = await classesCollection.findOne({ _id: new ObjectId(classId) });
        if (!classData) {
          return res.status(404).send({ message: 'Class not found' });
        }

        // Create slot object
        const slot = {
          trainerId: trainer._id,
          trainerEmail: trainer.email,
          trainerName: trainer.fullName,
          days,
          slotName,
          slotTime,
          classId: classData._id,
          className: classData.name,
          otherInfo: otherInfo || '',
          isBooked: false,
          createdAt: new Date().toISOString(),
        };

        const result = await slotsCollection.insertOne(slot);

        if (result.insertedId) {
          //  Only push slotId and classId into trainer doc
          await trainersCollection.updateOne(
            { _id: trainer._id },
            {
              $push: {
                slots: {
                  slotId: result.insertedId
                }
              }
            }
          );

          res.status(201).send({ message: 'Slot added successfully', insertedId: result.insertedId });
        } else {
          res.status(500).send({ message: 'Failed to add slot' });
        }
      } catch (error) {
        console.error('Error in /add-slot:', error);
        res.status(500).send({ message: 'Internal server error', error: error.message });
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



    // create payment intent for order
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body

      const totalPrice = price * 100
      // stripe...
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      })

      res.send({ clientSecret: paymentIntent.client_secret })
    })


    app.post('/check-slot-availability', verifyJWT, async (req, res) => {
      const { slotId } = req.body;
      try {
        const slot = await slotsCollection.findOne({ _id: new ObjectId(slotId) });
        if (!slot) return res.status(404).send({ message: 'Slot not found' });
        if (slot.isBooked) {
          return res.status(200).send({ available: false });
        }
        res.send({ available: true });
      } catch (err) {
        console.error('Error checking slot availability:', err);
        res.status(500).send({ message: 'Error checking slot availability' });
      }
    });



    app.post('/order', verifyJWT, async (req, res) => {
      try {
        const orderData = req.body;

        // Fetch full trainer document
        const trainer = await trainersCollection.findOne({ _id: new ObjectId(orderData.trainerId) });
        if (!trainer) return res.status(404).send({ message: 'Trainer not found' });

        // Fetch full class document
        const classData = await classesCollection.findOne({ _id: new ObjectId(orderData.classId) });
        if (!classData) return res.status(404).send({ message: 'Class not found' });

        // Fetch full slot document
        const slot = await slotsCollection.findOne({ _id: new ObjectId(orderData.slotId) });
        if (!slot) return res.status(404).send({ message: 'Slot not found' });

        // Compose booking document with full details embedded
        const bookingDoc = {
          transactionId: orderData.transactionId,
          userEmail: orderData.userEmail,
          paidAt: orderData.paidAt,
          trainer,
          class: classData,
          slot,
          price: orderData.price,
          createdAt: new Date().toISOString(),
        };

        // Insert booking document
        const result = await bookingsCollection.insertOne(bookingDoc);

        // Update bookingCount in class
        const classUpdate = await classesCollection.updateOne(
          { _id: new ObjectId(orderData.classId) },
          { $inc: { bookingCount: 1 } }
        );

        // Mark slot as booked
        const slotUpdate = await slotsCollection.updateOne(
          { _id: new ObjectId(orderData.slotId) },
          {
            $set: {
              isBooked: true,
              bookedBy: {
                email: orderData.userEmail,
                transactionId: orderData.transactionId,
                paidAt: orderData.paidAt,
              },
            },
          }
        );

        res.send({
          insertedId: result.insertedId,
          classUpdate,
          slotUpdate,
          message: 'Order placed and class/slot updated successfully',
        });
      } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).send({ message: 'Failed to place order', error: error.message });
      }
    });




    app.delete('/slot/:id', verifyJWT, verifyTrainer, async (req, res) => {
      try {
        const slotId = req.params.id;
        const trainerEmail = req.decoded.email;

        const slot = await slotsCollection.findOne({ _id: new ObjectId(slotId) });

        if (!slot) {
          return res.status(404).send({ message: 'Slot not found' });
        }

        if (slot.trainerEmail !== trainerEmail) {
          return res.status(403).send({ message: 'Forbidden: You can only delete your own slots' });
        }

        if (slot.isBooked) {
          return res.status(400).send({ message: 'Cannot delete a booked slot' });
        }

        const result = await slotsCollection.deleteOne({ _id: new ObjectId(slotId) });

        if (result.deletedCount === 1) {
          res.status(200).send({ message: 'Slot deleted successfully' });
        } else {
          res.status(500).send({ message: 'Failed to delete slot' });
        }
      } catch (error) {
        console.error('Error deleting slot:', error);
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
