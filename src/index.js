import express from "express"
import fs from "fs"
import multer from "multer"

const app = express();
app.use(express.json());
const EXPRESS_PORT = 3000;
const upload = multer({ dest: 'store/' });

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

app.post('/upload-file', upload.single('file'), (req, res)=> {

    const path = `store/${req.body.bucket}/${req.body.path}`
    fs.writeFile(`store/water.csv`, JSON.stringify(req.file), (err) => {
        if (err) {
          console.error('Error creating file', err);
          res.send({message:`Error creating file`});
          // How do I deal with errors in express again lol? Server status?
        } else {
          console.log('File created successfully!');
          res.send({message:`Created file in bucket ${req.body.bucket} at ${req.body.path}.`});
        }
      });
    
})

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});