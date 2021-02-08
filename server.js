require('dotenv').config()

// Server
const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http, {
    cors: {
        origin: '*',
        methods: ['GET', 'HEAD', 'POST', 'DELETE', 'PUT'],
    }
})
const { MongoClient } = require('mongodb')

const cors = require('cors')
const bodyParser = require('body-parser')
const {v4: uuid} = require('uuid')
const bcrypt = require('bcrypt')
const schedule = require('node-schedule')
const jwt = require('jsonwebtoken')
const md5 = require('md5')

const config = require('./package.json')

// #################################################
// .env
// #################################################

const PORT = process.env.PORT || 8081
const TOKEN = process.env.TOKEN
const MDB = process.env.MONGODB || "mongodb://localhost:27017/schoolnotes"

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.json({limit: '1mb'}))

// #################################################
// Import express routers

// #################################################

// #################################################
// /info
// #################################################

app.get(['/', '/version', '/info'], (req, res) => {
    res.json({
        info: `${config.name}@${config.version}`,
        type: config.name,
        version: config.version,
    })
})

// #################################################
// /share
// #################################################

app.route('/share')
    .get(async (req, res) => {
        const client = new MongoClient(MDB, { useUnifiedTopology: true })
        try {
            await client.connect()
            const db = client.db('school-notes')
            const sharedNotes = db.collection("sharedNotes")
            const result = await sharedNotes.findOne({_id: req.query._id})
            if (result)
                res.status(200).json({notes: result.notes})
            else{
                res.status(404).json({})}
        }
        catch(error){
            res.status(500).json({})
        }
        finally {
            await client.close()
        }
    })
    .post(async (req, res) => {
        const client = new MongoClient(MDB, { useUnifiedTopology: true })
        
        try {
            await client.connect()
            const db = client.db('school-notes')
            const sharedNotes = db.collection("sharedNotes")

            const hash = md5(JSON.stringify(req.body.notes))
            const r = await sharedNotes.find({hash: hash}).toArray()
            if (r.length === 0) {
                const _id = uuid()

                const today = new Date()
                const expires = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).getTime()
                await sharedNotes.insertOne({ _id, notes: req.body.notes, expires, hash })

                res.status(201).json({_id})
            }
            else {
                res.status(201).json({_id: r[0]._id})
            }    
        }
        catch(error){
            res.status(500).json({})
        }
        finally {
            await client.close()
        }
    })
    
// #################################################
// /user
// #################################################

app.route('/user')
    // sign in
    .post(authorizeExpress, async (req, res) => {
        if (req.user || !req.body.user) return res.sendStatus(403)
        //console.log(req.body.user);
        const {username, password} = req.body.user

        const client = new MongoClient(MDB, { useUnifiedTopology: true })
        
        try {
            await client.connect()
            const db = client.db('school-notes')
            const users = db.collection("users")

            const result = await users.findOne({ $and: [ {username: username}, {password: password} ] })
            //console.log(await users.find().toArray())
            //console.log(result)
            if (result){
                const jwtToken = jwt.sign({user: {_id: result._id, username: result.username}}, TOKEN, )
                res.status(200).json({jwt: jwtToken, username: result.username})
            }
            else res.sendStatus(404)
        }
        catch(error){
            res.sendStatus(500)
        }
        finally {
            await client.close()
        }

    })
    // sign up
    .put(authorizeExpress, async (req, res) => {
        if (req.user || !req.body.user) return res.sendStatus(403)
        
        const {username, password} = req.body.user

        console.log(req.body.user);

        const client = new MongoClient(MDB, { useUnifiedTopology: true })

        try {
            await client.connect()
            const db = client.db('school-notes')
            const users = db.collection("users")

            // Create a new userid
            const _id = uuid()

            // Check if user or _id already exists
            if (! await users.findOne({ $or: [ {_id: _id}, {username: username} ] })){

                // Check if username is a email address
                const email = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/.test(String(username).toLowerCase())
                
                await users.insertOne({ _id, username: username, password: password, email: email})

                console.log(await users.find().toArray())

                res.sendStatus(201)
            }
            else res.sendStatus(409)
        }
        catch(error){
            res.sendStatus(500)
        }
        finally {
            await client.close()
        }
    })
    // delete user
    .delete(authorizeExpress, async (req, res) => {
        if (!req.user) return res.sendStatus(403)

        const {_id, username} = req.user

        const client = new MongoClient(MDB, { useUnifiedTopology: true })

        try {
            await client.connect()
            const db = client.db('school-notes')

            const result = await db.collection("users").deleteOne({ $and: [ {_id: _id}, {username: username} ] })

            if (result.deletedCount === 1) res.sendStatus(200)
            else res.sendStatus(406)
        }
        catch(error){
            console.log(error);
            res.sendStatus(500)
        }
        finally {
            await client.close()
        }
    })

// #################################################
// Functions
// #################################################

function authorizeExpress(req, res, next){
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[0]
    
    if (token)
        jwt.verify(token, TOKEN, (err, payload) => {
            if (err) return res.sendStatus(403)
            req.user = payload.user;
        })

    next()
}

// #################################################
// SOCKET.IO
// #################################################

io.on('connection', socket => {
    const {username, _id} = jwt.verify(socket.handshake.auth.token, TOKEN).user

    console.log(`✳ ${username}`)

    socket.join(String(_id))

    socket.to(String(_id)).emit('pullNotes', { notes: ( () => {
        return []
    } )(), })

    socket.on('pushNotes', (...args) => {
        console.log(args);

        socket.to(String(_id)).emit('pullNotes', { notes: ( () => {
            return []
        } )(), })
    })


})


// #################################################
// Server listen
// #################################################

http.listen(PORT, () => console.log(`✅ Server listening on *:${PORT}`))