# school-notes-backend

__Version: >3.x.x__  
__Compatible with school-notes-frontend@3.x.x or later__

## Installation

__!__ *You need to install the frontend AND backend version to use 'School Notes'*

#### Native (Linux)

#### Docker

#### Frontend
[Documentation for installing the frontend version](https://github.com/osourcet/school-notes-frontend/blob/stable/README.md)


### Requests

['/', '/version', '/info' ]

- GET  → 200: {info, type, version}

'/share'

- GET  → 200: {notes: []} ; → 404: {} ; → 500: {}
- POST → 201: {_id}, → 500: {}