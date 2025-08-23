# Blockchain Integration Guide

This guide explains how to use the new blockchain controllers for user registration and credential management in your Credora server.

## Overview

The blockchain integration consists of three main controllers:

1. **BlockchainController** - Handles blockchain registration and network operations
2. **WalletController** - Manages wallet operations and transactions
3. **VerificationController** - Handles credential verification on blockchain

## Quick Start

### 1. Environment Setup

Make sure your `.env` file includes:

```env
# Blockchain Configuration
RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key_here
NETWORK_NAME=localhost

# Contract Addresses
CREDENTIAL_NFT_ADDRESS=0x...
CREDENTIAL_REGISTRY_ADDRESS=0x...
VERIFICATION_CONTRACT_ADDRESS=0x...
```

### 2. Test Blockchain Connection

```bash
curl http://localhost:5000/api/blockchain/network
```

## User Registration on Blockchain

### For Institutions/Organizations

1. **Check Registration Status**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:5000/api/blockchain/registration-status
   ```

2. **Register on Blockchain**
   ```bash
   curl -X POST \
        -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "organizationType": "institution",
          "organizationName": "University of Example",
          "organizationDetails": {
            "description": "Leading educational institution",
            "website": "https://example.edu",
            "location": "New York, USA"
          }
        }' \
        http://localhost:5000/api/blockchain/register
   ```

## Wallet Management

### Get Wallet Information
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/wallet/info
```

### Validate Wallet Address
```bash
curl http://localhost:5000/api/wallet/validate/0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84
```

### Sign Message
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Hello from Credora!"
     }' \
     http://localhost:5000/api/wallet/sign-message
```

### Get Transaction History
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:5000/api/wallet/transactions?limit=10&offset=0"
```

### Get Network Fees
```bash
curl http://localhost:5000/api/wallet/fees
```

### Get Credential Summary
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/wallet/credentials
```

## Credential Verification

### Verify Single Credential
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "tokenId": "123",
       "verifierAddress": "0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84"
     }' \
     http://localhost:5000/api/verification/verify
```

### Batch Verify Credentials
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "tokenIds": ["123", "124", "125"],
       "verifierAddress": "0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84"
     }' \
     http://localhost:5000/api/verification/batch-verify
```

### Verify Issuer Authority
```bash
curl http://localhost:5000/api/verification/issuer/0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84
```

### Get Verification Statistics
```bash
curl http://localhost:5000/api/verification/stats
```

## Gas Estimation

### Estimate Transaction Gas
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "to": "0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84",
       "value": "0.01",
       "data": "0x"
     }' \
     http://localhost:5000/api/wallet/estimate-gas
```

### Estimate Contract Function Gas
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "contractAddress": "CONTRACT_REGISTRY_ADDRESS",
       "methodName": "registerInstitution",
       "parameters": ["0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84", "Test University", "Description", "https://test.edu"]
     }' \
     http://localhost:5000/api/blockchain/estimate-gas
```

## Monitoring

### Check Transaction Status
```bash
curl http://localhost:5000/api/blockchain/transaction/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### Get Contract Events
```bash
curl "http://localhost:5000/api/blockchain/events?contractType=registry&eventName=InstitutionRegistered&fromBlock=0&toBlock=latest"
```

### Verify Contract Interaction
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/blockchain/verify-interaction
```

## Integration with Frontend

### User Registration Flow

1. **Check if user needs blockchain registration:**
   ```javascript
   const checkRegistration = async (token) => {
     const response = await fetch('/api/blockchain/registration-status', {
       headers: { 'Authorization': `Bearer ${token}` }
     });
     return response.json();
   };
   ```

2. **Register user on blockchain:**
   ```javascript
   const registerOnBlockchain = async (token, orgData) => {
     const response = await fetch('/api/blockchain/register', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify(orgData)
     });
     return response.json();
   };
   ```

### Credential Verification Flow

```javascript
const verifyCredential = async (tokenId, verifierAddress) => {
  const response = await fetch('/api/verification/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenId, verifierAddress })
  });
  return response.json();
};
```

### Wallet Information Display

```javascript
const getWalletInfo = async (token) => {
  const response = await fetch('/api/wallet/info', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

## Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Error message",
  "details": "Additional error details (if available)"
}
```

Common errors:
- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - User not authorized for blockchain operations
- `400 Bad Request` - Invalid input parameters
- `500 Internal Server Error` - Blockchain connection or contract interaction failed

## Security Considerations

1. **Private Keys**: Never expose private keys in client-side code
2. **Gas Limits**: Always estimate gas before transactions
3. **Transaction Confirmation**: Wait for appropriate confirmations
4. **Input Validation**: Validate all addresses and parameters
5. **Rate Limiting**: Implement rate limiting for blockchain operations

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Blockchain Tests
```bash
npm run test:blockchain
```

## Deployment

1. Deploy smart contracts to your target network
2. Update contract addresses in environment variables
3. Ensure sufficient ETH in deployer wallet for gas fees
4. Test all endpoints in staging environment

## Troubleshooting

### Common Issues

1. **"Provider connection failed"**
   - Check RPC_URL in environment
   - Verify network is running

2. **"Insufficient funds"**
   - Check wallet balance
   - Ensure enough ETH for gas fees

3. **"Contract not found"**
   - Verify contract addresses are correct
   - Check if contracts are deployed

4. **"User not authorized"**
   - Check if user is registered as institution
   - Verify blockchain registration status

### Logs

Check application logs for detailed error information:
```bash
tail -f logs/app.log
```

## Support

For additional support:
- Check the smart contract documentation
- Review blockchain logs
- Contact the development team

---

This integration provides a complete blockchain interface for your credential management system. The controllers handle all the complex blockchain interactions while providing simple REST APIs for your frontend applications.
