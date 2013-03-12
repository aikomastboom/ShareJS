# This is an implementation of the OT data backend for rest.
#
# This implementation isn't written to support multiple frontends

http = require 'http'

backend = null
createDb = require './index'

defaultOptions = {
  port: 8000,
  host: 'localhost',
  prefix: '/doc/',
  docType: 'json',
  backend: {
    type: 'none'
  },
  # when true, rest expects to talk to another sharejs server
  testing: true
}

# Valid options as above.
module.exports = RestDB = (options) ->
  return new Db if !(this instanceof RestDB)

  options ?= {}
  options[k] ?= v for k, v of defaultOptions

  proxy = http.createClient(options.port, options.host);

  dbOptions = options.backend
  backend = createDb dbOptions
  host = options.host
  port = options.port
  prefix = options.prefix
  docType = options.docType
  testing = options.testing

  # Creates a new document.
  # data = {snapshot, type:typename, [meta]}
  # calls callback(true) if the document was created or callback(false) if a document with that name
  # already exists.
  @create = (docName, docData, callback) ->
    console.log('@create', docName, docData)
    path = docName.replace('_', '/')
    if testing
      post_data = JSON.stringify(docData)
    else
      post_data = JSON.stringify(docData.snapshot)

    request_options = {
      method: 'POST',
      path: prefix + path,
      host: host,
      port: port,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': post_data.length
      }
    }
    request_options.method = 'PUT' if testing

    console.log('@create.request',request_options,docData)
    proxy_request = http.request request_options, (response) ->
      if response.statusCode != 200
        console.log("ERROR: @create.request Error creating document", response.statusCode)

      if backend
        return backend.create docName, docData, callback
      else
        callback?()

    proxy_request.write post_data
    proxy_request.end()

  # Get all ops with version = start to version = end. Noninclusive.
  # end is trimmed to the size of the document.
  # If any documents are passed to the callback, the first one has v = start
  # end can be null. If so, returns all documents from start onwards.
  # Each document returned is in the form {op:o, meta:m, v:version}.
  @getOps = (docName, start, end, callback) ->
    console.log('@getOps', docName, start, end)

    if start == end
      callback null, []
      return

    if backend
      return backend.getOps docName, start, end, callback
    else
      callback null, []


  # Write an op to a document.
  #
  # opData = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
  # callback = callback when op committed
  # 
  # opData.v MUST be the subsequent version for the document.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  # (its either that, or I have _another_ check when you append an op that the document already exists
  # ... and that would slow it down a bit.)
  @writeOp = (docName, opData, callback) ->
    console.log('@writeOp', docName, opData)

    if testing
      path = docName.replace('_', '/')
      post_data = JSON.stringify(opData)

      request_options = {
        method: 'POST',
        path: prefix + path,
        host: host,
        port: port,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': post_data.length,
          'X-OT-Version': opData.v
        }
      }

      console.log('@writeOp.request', request_options)
      proxy_request = http.request request_options, (response) ->
        if response.statusCode != 200
          console.log("ERROR: @writeOp.request Error writing OP", response.statusCode)

      proxy_request.write post_data
      proxy_request.end()
    else
      console.log('@writeOp is not supported for non sharejs REST api')


    if backend
      return backend.writeOp docName, opData, callback
    else
      callback()

  # Write new snapshot data to the database.
  #
  # docData = resultant document snapshot data. {snapshot:s, type:t, meta}
  #
  # The callback just takes an optional error.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  @writeSnapshot = (docName, docData, dbMeta, callback) ->
    console.log('@writeSnapshot', docName, docData, dbMeta)
    path = docName.replace('_', '/')
    post_data = JSON.stringify(docData.snapshot)

    request_options = {
      method: 'PUT',
      path: prefix + path,
      host: host,
      port: port,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': post_data.length
      }
    }
    if testing
      console.log('@writeSnapshot.request is not supported by sharejs rest api')
    else
      console.log('@writeSnapshot.request', request_options)
      proxy_request = http.request request_options, (response) ->
        if response.statusCode != 200
          console.log("ERROR: @writeSnapshot.request Error updating document", response.statusCode)

      proxy_request.write post_data
      proxy_request.end()

    if backend
      return backend.writeSnapshot docName, docData, dbMeta, callback
    else
      callback()


  # Data = {v, snapshot, type}. Error if the document doesn't exist.
  @getSnapshot = (docName, callback) ->
    console.log('@getSnapshot', docName)
    if backend
      docData = backend.getSnapshot docName, (err, docData) =>
        console.log('@getSnapshot.backend',docName, err, docData)
        return @getRestSnapshot docName, callback if err
        return callback null, docData
    else
      return @getRestSnapshot docName, callback


  @getRestSnapshot = (docName, callback) ->
    console.log('@getRestSnapshot', docName)
    path = docName.replace('_', '/')
    request_options = {
      method: 'GET',
      path: prefix + path,
      host: host,
      port: port,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      }
    }
    data = ""
    console.log('@getRestSnapshot.request', docName, request_options)
    proxy_request = http.request request_options, (response) ->
      if response.statusCode != 200
        console.log('@getRestSnapshot.request.Document does not exist', docName, response.statusCode)
        return callback? 'Document does not exist'
      else
        response.on 'data', (chunk) ->
          console.log('@getRestSnapshot.request.data: ',docName, chunk)
          data += chunk
      response.on 'end', () ->
        console.log('@getRestSnapshot.request.end.',docName)
        if data
          snapshot = JSON.parse(data)
          console.log('@getRestSnapshot.request.snapshop.', docName, snapshot)
          if testing
            docData = snapshot
          else
            docData = { v:0, snapshot:snapshot, type: docType}
          callback null, docData
        else
          if testing
            xotv = response.headers['x-ot-version']
            xottype = response.headers['x-ot-type']
            console.log('@getRestSnapshot no data ', docName, response.headers, v, type)
            callback null, { v:xotv, snapshot: '', type:xottype}
          else
            console.log('@getRestSnapshot.request."no data" Document does not exist', docName)
            return callback? 'Document does not exist'
    proxy_request.end()


  # Perminantly deletes a document. There is no undo.
  # Callback takes a single argument which is true iff something was deleted.
  @delete = (docName, dbMeta, callback) ->
    return backend.writeSnapshot docName, docData, dbMeta, callback if backend
    callback()

  # Close the connection to the database
  @close = ->
    client.quit()

  this
