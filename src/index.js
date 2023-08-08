import express from "express"
import fs from "fs"
import csv from "csv-parser"
import multer from "multer"

const app = express();
app.use(express.json());
const EXPRESS_PORT = 3000;

// DiskStorage gives me more control over where the file is stored
const storage = multer.diskStorage({
  destination: function (req, file, cb) {

    console.log(file);
    
    const dir_path = `store/${req.body.bucket}/${req.body.path}`
    console.log(dir_path);

    if (!fs.existsSync(dir_path)){
      fs.mkdir(dir_path, (err) => {
        if (err) {
          console.error('Error creating directory:', err);
        } else {
          console.log('Directory created successfully!');
          // Not sure what cb does
        }
      });
    }

    cb(null, dir_path)
  },

  filename: function (req, file, cb) {
    // req.body.filename is the same thing as file.originalname
    console.log('Wrote '+file.originalname);
    cb(null, file.originalname);
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

app.post('/upload-file', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'metadata_file', maxCount: 1 }]), (req, res)=> {
    
})

app.post('/filesys-read', (req, res) => {

  let query_promises = req.body.files.map((filepath) => {
    return query_csv(`store/${req.body.bucket}/${filepath}`, req.body.condition);
 });

 Promise.all(query_promises)
 .then( query_results => {
   //console.log(query_results);
   res.send({query_results: query_results});
 })
 .catch( err => {
   console.log("Error performing query on requested files", err);
 })

})

async function query_csv(filepath, value) {

  const read_stream = fs.createReadStream(filepath);

  return new Promise((resolve, reject) => {
    let query_results = [];

    read_stream.pipe(csv())
    .on('data', 
      (row) => {
        if ((row['energy(kWh/hh)'].trim() <= (value+0.0001)) && (row['energy(kWh/hh)'].trim() >= (value-0.0001))) {
          query_results.push(row);
        }
    })
    .on('end', () => {
      console.log('Query completed');
      resolve(query_results);
    })
    .on('error', (error) => {
      reject(error);
    });
  })
}

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});