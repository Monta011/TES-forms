const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:fakepassword@1.2.3.4:5432/postgres",
        },
    },
});

async function run() {
    try {
        console.log("Calling $connect()...");
        await prisma.$connect();
        console.log("$connect() returned SUCCESSSFULLY!");

        console.log("Running query...");
        await prisma.$queryRaw`SELECT 1`;
        console.log("Query SUCCESS!");
    } catch (e) {
        console.log("FAILURE:", e.message);
    }
}
run();
