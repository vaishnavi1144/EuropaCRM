import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: './backend/.env' });
const prisma = new PrismaClient();
async function run(){
  await prisma.$connect();
  const res = await prisma.$queryRaw`select column_name from information_schema.columns where table_schema='public' and table_name='"BenchInterview"'`;
  console.log('columns for BenchInterview (quoted):', res);
  const res2 = await prisma.$queryRaw`select column_name from information_schema.columns where table_schema='public' and table_name='bench_interview'`;
  console.log('columns for bench_interview:', res2);
  const res3 = await prisma.$queryRaw`select column_name from information_schema.columns where table_schema='public' and table_name='"SubmissionEmail"'`;
  console.log('columns for SubmissionEmail (quoted):', res3);
  const res4 = await prisma.$queryRaw`select column_name from information_schema.columns where table_schema='public' and table_name='submission_email'`;
  console.log('columns for submission_email:', res4);
  await prisma.$disconnect();
}
run().catch(err=>{console.error(err); process.exit(1)});
