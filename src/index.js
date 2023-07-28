import express from "express"
import fs from "fs"

const app = express();
app.use(express.json());
const EXPRESS_PORT = 3000;

app.post('/new-bucket', (req, res)=> {
    res({message:`Created bucket with the name: ${req.body.name}`});

})

app.post('/create-file', (req, res)=> {
    
})

app.listen(EXPRESS_PORT, () => {
    console.log("Filesystem listening on port "+EXPRESS_PORT);
});