// MongoDB initialization script
// This script creates the database and initial collections

db = db.getSiblingDB('credora');

// Create collections
db.createCollection('users');
db.createCollection('credentials');

// Create indexes for better performance
db.users.createIndex({ "walletAddress": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "userType": 1 });
db.users.createIndex({ "isVerified": 1 });

db.credentials.createIndex({ "tokenId": 1 }, { unique: true });
db.credentials.createIndex({ "recipient.address": 1 });
db.credentials.createIndex({ "issuer.address": 1 });
db.credentials.createIndex({ "status": 1 });
db.credentials.createIndex({ "credentialData.credentialType": 1 });
db.credentials.createIndex({ "createdAt": -1 });

// Compound indexes
db.credentials.createIndex({ "recipient.address": 1, "status": 1 });
db.credentials.createIndex({ "issuer.address": 1, "status": 1 });

console.log('Database initialization completed successfully!');
