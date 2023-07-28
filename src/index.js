import express from "express"
import fs from "fs"

const app = express();
app.use(express.json());
const EXPRESS_PORT = 3000;

app.post('/new-bucket', (req, res)=> {

    // Remember: This path is from app/ as thats the Docker working directory
    fs.mkdir(`store/${req.body.bucket}`, (err) => {
        if (err) {
          console.error('Error creating directory:', err);
          res.send({message:`Error creating bucket`});
          // How do I deal with errors in express again lol? Server status?
        } else {
          console.log('Directory created successfully!');
          res.send({message:`Created bucket with the name: ${req.body.bucket}`});
        }
      });
})

app.post('/create-file', (req, res)=> {
    
})

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});