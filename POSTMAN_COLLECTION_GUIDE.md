# Credora API Postman Collection Guide

## 📦 **Collection Overview**

The Credora Blockchain API Postman collection provides comprehensive testing for your blockchain-based credential management system. It includes 40+ requests organized into 8 logical groups.

## 🚀 **Quick Setup**

### 1. Import Files into Postman

1. **Import Collection**:
   - Open Postman
   - Click "Import" button
   - Select `Credora_Blockchain_API.postman_collection.json`

2. **Import Environments**:
   - Import `Credora_Development.postman_environment.json`
   - Import `Credora_Production.postman_environment.json`

3. **Select Environment**:
   - Choose "Credora Development" for local testing
   - Choose "Credora Production" for production testing

### 2. Configure Environment Variables

Update these variables in your selected environment:

```
base_url: http://localhost:5000 (development)
wallet_address: Your test wallet address
jwt_token: Will be auto-populated after login
test_token_id: A valid credential token ID for testing
```

## 📋 **Collection Structure**

### 01. Authentication
- **Get Login Challenge**: Get nonce and message for wallet signature
- **Login with Wallet**: Authenticate and get JWT token (auto-saves to environment)
- **Get Profile**: Get current user information
- **Check Wallet Availability**: Check if wallet is already registered

### 02. Organization Management
- **Create Organization Application**: Apply for institution/company status
- **Get User Applications**: View your applications
- **Get All Applications (Admin)**: Admin view of all applications
- **Review Application (Admin)**: Approve/reject applications
- **Get Verified Organizations**: Public list of verified organizations

### 03. Blockchain Operations
- **Get Network Info**: Blockchain network status and information
- **Check Blockchain Registration Status**: Check if user is registered on-chain
- **Register on Blockchain**: Register approved organization on blockchain
- **Estimate Gas**: Estimate gas costs for transactions
- **Get Transaction Status**: Monitor transaction status
- **Get Contract Events**: Query blockchain events
- **Verify Contract Interaction**: Test blockchain connectivity

### 04. Wallet Management
- **Get Wallet Info**: Wallet balance, transaction count, credentials
- **Validate Wallet Address**: Check if address format is valid
- **Sign Message**: Sign messages with wallet
- **Get Transaction History**: View wallet transaction history
- **Estimate Transaction Gas**: Estimate gas for transfers
- **Get Network Fees**: Current gas prices
- **Get Credential Summary**: View owned credentials

### 05. Credential Management
- **Issue Single Credential**: Issue credential to recipient
- **Batch Issue Credentials**: Issue multiple credentials at once
- **Get Issued Credentials**: View credentials you've issued
- **Get Credential Details**: Get specific credential information
- **Revoke Credential**: Revoke a credential with reason
- **Get Dashboard**: Institution dashboard with statistics

### 06. Verification
- **Verify Single Credential**: Verify credential authenticity
- **Batch Verify Credentials**: Verify multiple credentials
- **Get Verification History**: View credential verification history
- **Verify Issuer Authority**: Check if issuer is authorized
- **Create Verification Request**: Request detailed verification
- **Get Verification Stats**: System-wide verification statistics

### 07. File Management
- **Upload File**: Upload documents/images
- **Download File**: Download uploaded files

### 08. Health Check
- **Health Check**: System status and configuration
- **API Documentation**: Available endpoints

## 🔄 **Testing Workflows**

### Complete Institution Registration Flow

1. **Authentication**:
   ```
   GET Login Challenge → POST Login with Wallet
   ```

2. **Apply for Institution Status**:
   ```
   POST Create Organization Application
   ```

3. **Admin Approval** (requires admin account):
   ```
   GET All Applications → POST Review Application (approve)
   ```

4. **Blockchain Registration**:
   ```
   POST Register on Blockchain → GET Registration Status
   ```

5. **Issue Credentials**:
   ```
   POST Issue Single Credential → GET Issued Credentials
   ```

### Credential Verification Flow

1. **Verify Credential**:
   ```
   POST Verify Single Credential
   ```

2. **Check Issuer**:
   ```
   GET Verify Issuer Authority
   ```

3. **View History**:
   ```
   GET Verification History
   ```

### Company Hiring Flow

1. **Verify Candidate's Credentials**:
   ```
   POST Batch Verify Credentials
   ```

2. **Issue Employment Certificate**:
   ```
   POST Issue Single Credential (employment type)
   ```

## ⚙️ **Environment Configuration**

### Development Environment
```json
{
  "base_url": "http://localhost:5000",
  "wallet_address": "0x742d35Cc6634C0532925a3b8D82Fd4C2C6B24b84",
  "jwt_token": "auto-populated",
  "test_token_id": "1"
}
```

### Production Environment
```json
{
  "base_url": "https://api.credora.tech",
  "wallet_address": "your_production_wallet",
  "jwt_token": "auto-populated",
  "test_token_id": "production_token_id"
}
```

## 🧪 **Automated Testing Features**

### Pre-request Scripts
- **JWT Token Expiry Check**: Warns when token is about to expire
- **Environment Validation**: Ensures required variables are set

### Test Scripts
- **Response Time Validation**: Ensures responses under 5 seconds
- **Content Type Validation**: Verifies JSON responses
- **Auto Token Extraction**: Saves JWT token from login response

### Global Variables
- **Automatic Token Management**: JWT token is automatically saved and used
- **Dynamic Token ID**: Use {{test_token_id}} for credential operations
- **Flexible Addressing**: Use {{wallet_address}} throughout tests

## 🔧 **Customization**

### Adding New Requests

1. **Copy Existing Request**: Use similar request as template
2. **Update Variables**: Use environment variables for flexibility
3. **Add Tests**: Include response validation tests
4. **Document Purpose**: Add clear descriptions

### Environment-Specific Testing

```javascript
// Pre-request script example
if (pm.environment.get("base_url").includes("localhost")) {
    // Development-specific setup
    console.log("Running in development mode");
} else {
    // Production-specific setup
    console.log("Running in production mode");
}
```

## 📊 **Monitoring and Reports**

### Collection Runner
1. **Select Collection**: Credora Blockchain API
2. **Choose Environment**: Development or Production
3. **Select Requests**: Choose specific folders or all requests
4. **Run Collection**: Execute automated test suite

### Test Reports
- **Response Times**: Monitor API performance
- **Success Rates**: Track passing/failing requests
- **Error Analysis**: Identify common failure points

## 🚨 **Troubleshooting**

### Common Issues

1. **JWT Token Expired**:
   ```
   Solution: Re-run "Login with Wallet" request
   ```

2. **Invalid Wallet Address**:
   ```
   Solution: Update wallet_address in environment
   ```

3. **Blockchain Connection Failed**:
   ```
   Solution: Check "Get Network Info" request first
   ```

4. **Insufficient Permissions**:
   ```
   Solution: Ensure user has correct role (institution/admin)
   ```

### Request Dependencies

Some requests depend on others:
- **Authentication required**: Most requests need JWT token
- **Admin required**: Application review endpoints
- **Blockchain registration required**: Credential issuance
- **Existing credentials required**: Verification endpoints

## 📝 **Best Practices**

1. **Test Order**: Follow the logical flow (auth → application → blockchain → credentials)
2. **Environment Management**: Use separate environments for dev/prod
3. **Variable Usage**: Use {{variable}} syntax for reusability
4. **Error Handling**: Check response codes and error messages
5. **Documentation**: Keep request descriptions up to date

## 🔐 **Security Notes**

- **Never commit**: Don't commit files with real JWT tokens or private keys
- **Environment Separation**: Keep production and development separate
- **Token Management**: Tokens expire, re-authenticate regularly
- **Sensitive Data**: Use Postman's secret variable type for sensitive data

## 📈 **Advanced Usage**

### Collection Variables vs Environment Variables
- **Collection**: Shared across all environments
- **Environment**: Specific to dev/prod environments

### Dynamic Testing
```javascript
// Test script example
pm.test("Credential was issued successfully", function () {
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    
    // Save token ID for future tests
    if (response.credential && response.credential.tokenId) {
        pm.environment.set("test_token_id", response.credential.tokenId);
    }
});
```

This collection provides everything needed to test your Credora blockchain API comprehensively! 🎉
