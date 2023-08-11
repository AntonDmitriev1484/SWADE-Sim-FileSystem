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

  const query_predicates = build_query_predicates(req.body.where);
  const query_promises = req.body.from_files.map((filepath) => {
    return query_csv(`store/${req.body.in_bucket}/${filepath}`, req.body.select_fields, query_predicates);
 });

 Promise.allSettled(query_promises)
 .then( query_results => {
   console.log('FS '+query_results);
   res.send({query_results: query_results});
 })
 .catch( err => {
   console.log("Error performing query on requested files", err);
 })

})

async function query_csv(filepath, select_fields, predicates) {

  // predicates replace 'value'

  const read_stream = fs.createReadStream(filepath);

  return new Promise((resolve, reject) => {
    let query_results = [];

    read_stream.pipe(csv())
    .on('data', 
      (row) => {

        // Each predicate checks some field, on some range
        // When all predicates are true, we know this row satisifes our query
        let fulfills_predicates = predicates.reduce( (acc, predicate) => {
          return acc && predicate(row); 
        }, true)

        if (fulfills_predicates) {
          // Filter all fields in the row to be just what was request by
          // select_fields in the query
          let row_result = {};
          select_fields.forEach((field) => {
            row_result[field] = row[field]
          })
          query_results.push(row_result);
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

// Converts json 'where' clauses to an array of predicates we can run through on each row 
function build_query_predicates(where_clause) {
  return where_clause.map(
    (clause) => {

      // Depending on what field our clause checks, we need to convert to the proper comparable objects
      let f = (field) => {

        if (field === undefined) {
          return field;
        }

        if (clause.field === 'tstp') {
          //console.log(`String read in row: ${field}`);

          // For NOT MAC02 files
          const dateTimeString = field;
          const [datePart, timePart] = dateTimeString.split(' '); // Split date and time parts
          const [year, month, day] = datePart.split('-').map(Number); // Parse year, month, day
          const [hours, minutes, seconds] = timePart.split(':').map(Number); // Parse hours, minutes, seconds

          // Create a new Date object with the parsed values
          const dateTime = new Date(year, month - 1, day, hours, minutes, seconds);
          
          //console.log(`Converted dateTime object: ${dateTime}`);
          return dateTime;
        }
        else if (clause.field === 'energy(kWh/hh)') {
          return field.trim();
        }

      }

      const lower = f(clause.range[0]);
      const upper = f(clause.range[1]);

      if (clause.range[0] === undefined) { // Lower range = inf
        return row => (f(row[clause.field]) < upper)
      }
      else if (clause.range[1] === undefined) { // Upper range = inf
        return row => (f(row[clause.field]) > lower)
      }
      else { // We have a range
        return row => {
          const formatted_field = f(row[clause.field])
          const above_lower = formatted_field > lower
          const below_upper = formatted_field < upper

          return (above_lower && below_upper);
        }
      }
    }
  )
}

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});