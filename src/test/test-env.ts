import dotenv from 'dotenv';
dotenv.config();

console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);

//npx tsx src/test/test-env.ts