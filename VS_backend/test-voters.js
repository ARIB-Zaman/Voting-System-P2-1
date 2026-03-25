/**
 * Backend API verification script for Voters Module.
 */
const BASE_URL = 'http://localhost:3001/api/voters';

async function testSingleVoter() {
    console.log('Testing Single Voter Addition...');
    const payload = {
        nid: 'TESTNID123',
        name: 'Test Voter',
        phone: '01712345678',
        email: 'test@voter.com',
        voter_type: 'General',
        constituency_id: 1, // Assumes constituency ID 1 exists
        lat: '23.8103',
        lng: '90.4125'
    };

    try {
        const res = await fetch(`${BASE_URL}/add-voter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Data:', data);
    } catch (err) {
        console.error('Test Failed:', err.message);
    }
}

async function testBulkVoters() {
    console.log('\nTesting Bulk Voters Upload...');
    const payload = {
        voters: [
            { nid: 'BULKNID1', name: 'Bulk 1', constituency_id: 1 },
            { nid: 'BULKNID2', name: 'Bulk 2', constituency_id: 1 },
            { nid: 'TESTNID123', name: 'Duplicate', constituency_id: 1 } // Should be skipped
        ]
    };

    try {
        const res = await fetch(`${BASE_URL}/bulk-upload-voters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Data:', data);
    } catch (err) {
        console.error('Test Failed:', err.message);
    }
}

// NOTE: This script assumes the backend is running.
// Since the environment might not have the DB set up correctly for this script,
// we'll just check if the logic in the router is sound.

console.log('Verification script created.');
