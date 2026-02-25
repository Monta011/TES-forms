console.log("Testing URL parsing manually:");

function testParsing(urlString) {
    try {
        let url = urlString;
        url = url.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        const parsedUrl = new URL(url);
        parsedUrl.searchParams.set('connection_limit', '20');
        parsedUrl.searchParams.set('pool_timeout', '0');
        parsedUrl.searchParams.set('connect_timeout', '60');
        if (!parsedUrl.searchParams.has('pgbouncer')) {
            parsedUrl.searchParams.set('pgbouncer', 'true');
        }
        console.log("SUCCESS:", parsedUrl.toString());
    } catch (e) {
        console.warn("FAILED:", e.message);
    }
}

testParsing('postgresql://postgres.eezmmhlaeglpipvpssbb:wBVyzZmVi2qBU0IR@aws-1-ap-south-1.pooler.supabase.com:6543/postgres');
testParsing('"postgresql://postgres.eezmmhlaeglpipvpssbb:wBVyzZmVi2qBU0IR@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"');
