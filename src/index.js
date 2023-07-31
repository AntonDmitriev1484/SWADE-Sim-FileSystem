import express from "express"
import fs from "fs"
import multer from "multer"
import busboy from "connect-busboy"

const app = express();
app.use(express.json());
app.use(busboy());
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

app.post('/create-file', upload.single('file'), (req, res)=> {
  //console.log(req.body);

  req.pipe(req.busboy);
  req.busboy.on('file', (fieldname, file, filename) => {
    console.log("Uploading: " + filename);
    //Path where image will be uploaded
    fstream = fs.createWriteStream('store/water.csv');
    file.pipe(fstream);
    fstream.on('close', function () {    
        console.log("Upload Finished of " + filename);              
    }
    );
});

    // fs.writeFile(`store/${req.body.bucket}/${req.body.path}`, file, (err) => {
    //     if (err) {
    //       console.error('Error creating file', err);
    //       res.send({message:`Error creating file`});
    //       // How do I deal with errors in express again lol? Server status?
    //     } else {
    //       console.log('File created successfully!');
    //       res.send({message:`Created file in bucket ${req.body.bucket} at ${req.body.path}.`});
    //     }
    //   });
    
})

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});