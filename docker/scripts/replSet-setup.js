try {
    rs.initiate( {
        _id: "rs0",
        members: [
          { _id: 0, host: "mongodb-rs0:27017" }
        ]
    });
}
catch (error) {
    print( error.toString() );
}
finally {
    print( rs.status() );
}
