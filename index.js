const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.hqx62.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const toolsCollections = client.db("comp-solution").collection("tools");
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
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This is Comp-Solution server running");
});

app.listen(port, () => {
  console.log(`Lesting to port ${port}`);
});
