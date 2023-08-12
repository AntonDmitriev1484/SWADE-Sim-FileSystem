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


// {
//   "user": process.env.USERNAME,
//   "select_fields": ['tstp', 'energy(kWh/hh)', 'LCLid'],
//   "in_bucket": "A",
//   "from_files": ['test/MAC000003.csv', 'test/MAC000004.csv'],
//   "where": [
//       { field: 'tstp', range: ['2013-01-01 00:00:00', '2013-01-03 00:00:00']},
//       { field: 'energy(kWh/hh)', range: ['0.120', '0.150']}
//   ]
// }

app.post('/filesys-read', (req, res) => {

  const query_predicates = build_query_predicates(req.body.where);
  const query_promises = req.body.from_files.map((filepath) => {
    const query_stopper = build_query_stopper(req.body.where, filepath);
    return query_csv(`store/${req.body.in_bucket}/${filepath}`, req.body.select_fields, query_predicates, query_stopper);
 });

 Promise.allSettled(query_promises)
 .then( query_results => {
   console.log('FS '+JSON.stringify(query_results));
   res.send({query_results: query_results});
 })
 .catch( err => {
   console.log("Error performing query on requested files", err);
 })

})

async function query_csv(filepath, select_fields, predicates, should_stop_query) {

  // predicates replace 'value'

  const read_stream = fs.createReadStream(filepath);

  return new Promise((resolve, reject) => {
    let query_results = [];

    read_stream.pipe(csv())
    .on('data', 
      (row) => {

        if (should_stop_query(row)) {
          resolve(query_results);
          read_stream.unpipe();
        }
        else {

          console.log(row['day']);
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

function build_query_stopper(where_clause, filepath) {
  const tstp_where_clause = where_clause.find( clause => clause.field === 'tstp' )
  const tstp_in_query =  tstp_where_clause !== undefined;
  // Band-aid solution, just send in the whole filepath, for my test case
  // it doesn't really matter, the indexOf MAC or block detection will still work correctly

  const cleaned_file = filepath.indexOf('MAC') !== -1; // MAC files are cleaned data
  return (row) => {
     console.log('tstp in query? :'+ tstp_in_query);
     console.log('cleand file? '+ cleaned_file);
    if (tstp_in_query && cleaned_file) { // If we're looking at timestamps, and in a cleaned file, we might be able to end early
      const val = f(row['tstp'], 'tstp');
      const upper = f(tstp_where_clause.range[1], 'tstp');
      console.log(`val: ${val}, upper: ${upper}.`);
      return val > upper; // Return true: stop when row tstp is greater than the upper bound of our range
    }
    else {
      return false; // Never stop if we aren't on a clean file
    }
  }
}

// Converts json 'where' clauses to an array of predicates we can run through on each row 
function build_query_predicates(where_clause) {
  return where_clause.map(
    (clause) => {

      const field_name = clause.field; 
      // What field we're accessing in the row
      // tells us how to format the value we're reading out of it for comparison

      const lower = f(clause.range[0], field_name);
      const upper = f(clause.range[1], field_name);

      if (clause.range[0] === undefined) { // Lower range = inf
        return row => (f(row[clause.field], field_name) < upper)
      }
      else if (clause.range[1] === undefined) { // Upper range = inf
        return row => (f(row[clause.field], field_name) > lower)
      }
      else { // We have a range
        return row => {
          const value = f(row[field_name], field_name)
          console.log(`upper: ${upper} val: ${value} lower: ${lower}`);
          const above_lower = value > lower
          const below_upper = value < upper

          return (above_lower && below_upper);
        }
      }
    }
  )
}

const formatters = {
  'tstp': (value) => { // Will only be used querying MAC files
    //console.log(`String read in row: ${field}`);
    // For NOT MAC02 files
    const dateTimeString = value;
    const [datePart, timePart] = dateTimeString.split(' '); // Split date and time parts
    const [year, month, day] = datePart.split('-').map(Number); // Parse year, month, day
    const [hours, minutes, seconds] = timePart.split(':').map(Number); // Parse hours, minutes, seconds

    // Create a new Date object with the parsed values
    const dateTime = new Date(year, month - 1, day, hours, minutes, seconds);
    
    //console.log(`Converted dateTime object: ${dateTime}`);
    return dateTime;
  },
  'day': (value) => { // Will only be used querying Block files 
    // For some reason, even though its written as mm/dd/yyyy it gets parsed as yyyy-mm-dd
    const dateString = value.trim();
    const [year, month, day] = dateString.split('-').map(Number);
    // Create a new Date object with the parsed values
    const dateTime = new Date(year, month - 1, day);
    console.log(`val ${dateString} -> ${dateTime}`);
    return dateTime;
  },
  'energy(kWh/hh)': (value) => {
    return value.trim();
  }
}

// Formatter function. Format value by field_name's standard to make it comparable
function f(value, field_name) {
  if (value === undefined) {
    return value;
  }

  return formatters[field_name](value);
}

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});