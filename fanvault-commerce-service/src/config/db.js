const mongoose = require('mongoose');
const {
  SecretsManagerClient,
  GetSecretValueCommand
} = require("@aws-sdk/client-secrets-manager");

// Initialize Secrets Manager Client
const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "us-east-1"
});

async function connectDB() {
  let mongoURI = process.env.MONGO_URI;
  const useSecretsManager = process.env.USE_SECRETS_MANAGER === 'true' || process.env.NODE_ENV === 'production';

  if (useSecretsManager) {
    const secretId = process.env.SECRET_ID || "production/mongodb";
    console.log(`[db] Fetching secret '${secretId}' from AWS Secrets Manager...`);
    try {
      const response = await client.send(
        new GetSecretValueCommand({
          SecretId: secretId
        })
      );

      const secret = JSON.parse(response.SecretString);

      // Extract credentials and host info
      const username = secret.username;
      const password = secret.password;
      const host = secret.host;
      const port = secret.port || 27017;
      const database = secret.database || "fanvault_db";
      const authSource = secret.authSource || secret.database || "admin";

      // Dynamically construct connection URI
      mongoURI = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=${authSource}`;
      console.log(`[db] MongoDB URI built dynamically using retrieved secret.`);

      // Optional: Inject JWT secrets if they are in Secrets Manager as well
      if (secret.jwtSecret) {
        process.env.JWT_SECRET = secret.jwtSecret;
        console.log(`[db] Loaded JWT_SECRET from Secrets Manager.`);
      }

    } catch (error) {
      console.error("❌ Failed to fetch database secrets from AWS Secrets Manager:", error.message);
      if (!mongoURI) {
        console.error("❌ No fallback MONGO_URI env variable is set. Exiting...");
        throw error;
      }
      console.log(`[db] Falling back to local MONGO_URI environment variable.`);
    }
  }

  if (!mongoURI) {
    throw new Error("MONGO_URI environment variable is not defined and could not be loaded from AWS Secrets Manager.");
  }

  // Connect to mongoose
  await mongoose.connect(mongoURI);
  console.log("✅ MongoDB Connected Successfully");
}

module.exports = { connectDB };
