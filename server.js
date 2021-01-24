const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const {v4: uuid} = require('uuid')
const bcrypt = require('bcrypt')
const schedule = require('node-schedule')
const jwt = require('jsonwebtoken')
const { MongoClient } = require('mongodb')

const config = require('./package.json')

const app = express()
const port = process.env.PORT || 8081
const mdb = process.env.MDB || "mongodb://localhost:27017"

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.json({limit: '1mb'}))

// #################################################
// GET
// #################################################

app.get(['/', '/version', '/info'], (req, res) => {
    res.json({
        info: `${config.name}@${config.version}`,
        type: config.name,
        version: config.version,
    })
})

app.get('/share', async (req, res) => {
    const client = new MongoClient(mdb, { useUnifiedTopology: true })

    try {
        await client.connect()
        const db = client.db('school-notes')
        const sharedNotes = db.collection("sharedNotes")
        const result = await sharedNotes.findOne({_id: req.query.id})
        if (result)
            res.status(200).json({notes: result.notes})
        else
            res.status(404).json({})
    }
    catch(error){
        res.status(500).json({})
    }
    finally {
        await client.close()
    }
})

// #################################################
// POST
// #################################################

// #################################################
// PUT
// #################################################

app.post('/share', async (req, res) => {
    const client = new MongoClient(mdb, { useUnifiedTopology: true })
    
    try {
        await client.connect()
        const db = client.db('school-notes')
        const sharedNotes = db.collection("sharedNotes")
        const _id = uuid()

        const today = new Date()
        const expires = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).getTime()

        await sharedNotes.insertOne({ _id, notes: req.body.notes, expires})

        res.status(201).json({_id})
    }
    catch(error){
        res.status(500).json({})
    }
    finally {
        await client.close()
    }
})

// #################################################
// DELETE
// #################################################

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))