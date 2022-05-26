const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.hqx62.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnauthorizedError" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {
  try {
    await client.connect();
    const toolsCollections = client.db("comp-solution").collection("tools");
    const orderCollection = client.db("comp-solution").collection("orders");
    const usersCollection = client.db("comp-solution").collection("users");
    const paymentCollection = client.db("comp-solution").collection("payments");
    const reviewCollection = client.db("comp-solution").collection("reviews");

    const verifyAdmin = async (req, res, next) => {
      const initiator = req.decoded.email;
      const initiatorAccount = await usersCollection.findOne({
        email: initiator,
      });
      if (initiatorAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden access" });
      }
    };

    app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
      const order = req.body;
      const price = order.productPrice
;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });

    // Get all product information
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolsCollections.find(query);
      const tools = await cursor.toArray();
      res.send(tools);
    });

    // Get specific product information
    app.get("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await toolsCollections.findOne(query);
      res.send(tool);
    });

    app.post("/tools", async (req, res) => {
      const newProduct = req.body;
      const result = await toolsCollections.insertOne(newProduct);
      res.send(result);
    });

    app.get("/available", async (req, res) => {});

    app.get("/order", verifyJWT, async (req, res) => {
      const customeremail = req.query.customeremail;
      const authorization = req.headers.authorization;
      const decodedEmail = req.decoded.email;
      if (customeremail == decodedEmail) {
        const query = { customerEmail: customeremail };
        const order = await orderCollection.find(query).toArray();
        return res.send(order);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
      console.log(authorization);
    });

    app.get('/orders/:id', verifyJWT, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const orders = await orderCollection.findOne(query);
      res.send(orders);
    })

    app.get('/order/availabel', verifyJWT,verifyAdmin, async (req, res) => {
      const query = {};
      const cursor = orderCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    })
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    app.put('/orders/:id', verifyJWT, async(req, res) =>{
      const id  = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          paymentStatus: payment.paymentStatus,
          transactionId: payment.transactionId
        }
      }

      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc);
    })


    app.put('/status/:id', verifyJWT,verifyAdmin, async(req, res) =>{
      const id  = req.params.id;
      const status = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          paymentStatus: status.paymentStatus,
        }
      }

      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc);
    })


    app.delete('/orders/:id', verifyJWT, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    })


    app.get("/user", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    app.delete("/user/:email", verifyJWT,verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", verifyJWT,verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updatedDoc = {
        $set: { role: "admin" },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    app.post("/reviews",verifyJWT, async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });


  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is Comp-Solution server running fine");
});

app.listen(port, () => {
  console.log(`Lesting to port ${port}`);
});