import express from "express"
import fs from "fs"
import multer from "multer"

const app = express();
app.use(express.json());
const EXPRESS_PORT = 3000;

// DiskStorage gives me more control over where the file is stored
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    
    const dir_path = `store/${req.body.bucket}/${req.body.path}`
    fs.mkdir(dir_path, (err) => {
      if (err) {
        console.error('Error creating directory:', err);
      } else {
        console.log('Directory created successfully!');
        // Not sure what cb does
        cb(null, dir_path)
      }
    });
  },
  filename: function (req, file, cb) {
    cb(null, req.body.filename)
  }
})
const upload = multer({ storage: storage });

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

    
})

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});