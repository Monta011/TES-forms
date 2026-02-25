const dns = require('dns');

async function testDNS() {
    console.log('Testing resolution for: aws-1-ap-south-1.pooler.supabase.com');

    // Try checking A records (IPv4)
    dns.resolve4('aws-1-ap-south-1.pooler.supabase.com', (err, addresses) => {
        if (err) {
            console.log('IPv4 Error:', err.message);
        } else {
            console.log('IPv4 Addresses:', addresses);
        }

        // Try checking AAAA records (IPv6)
        dns.resolve6('aws-1-ap-south-1.pooler.supabase.com', (err, addresses) => {
            if (err) {
                console.log('IPv6 Error:', err.message);
            } else {
                console.log('IPv6 Addresses:', addresses);
            }
        });
    });
}

testDNS();
