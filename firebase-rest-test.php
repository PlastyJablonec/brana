<?php
/**
 * Firebase REST API Test
 * Přímé testování Firebase Firestore přes REST API
 * Spusť: php firebase-rest-test.php
 */

echo "🚀 Firebase REST API Test\n";
echo "========================\n\n";

$PROJECT_ID = 'brana-a71fe';
$BASE_URL = "https://firestore.googleapis.com/v1/projects/{$PROJECT_ID}/databases/(default)/documents";

function makeRequest($url, $method = 'GET', $data = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'code' => $httpCode,
        'body' => json_decode($response, true)
    ];
}

// Test 1: List all users
echo "1️⃣ Testing Firestore connection...\n";
$response = makeRequest($BASE_URL . '/users');

if ($response['code'] !== 200) {
    echo "❌ Connection failed: HTTP {$response['code']}\n";
    if (isset($response['body']['error'])) {
        echo "   Error: {$response['body']['error']['message']}\n";
    }
    exit(1);
}

echo "✅ Connection successful\n\n";

// Count users
$users = $response['body']['documents'] ?? [];
echo "2️⃣ Analyzing users...\n";
echo "📊 Total users: " . count($users) . "\n";

$statusCounts = [];
$pendingUsers = [];

foreach ($users as $user) {
    $fields = $user['fields'] ?? [];
    
    // Extract status
    $status = 'unknown';
    if (isset($fields['status']['stringValue'])) {
        $status = $fields['status']['stringValue'];
    }
    
    $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
    
    // Collect pending users
    if ($status === 'pending') {
        $email = $fields['email']['stringValue'] ?? 'unknown';
        $displayName = $fields['displayName']['stringValue'] ?? 'unknown';
        $requestedAt = $fields['requestedAt']['timestampValue'] ?? 'unknown';
        
        $pendingUsers[] = [
            'email' => $email,
            'displayName' => $displayName,
            'requestedAt' => $requestedAt
        ];
    }
}

echo "\n📊 Users by status:\n";
foreach ($statusCounts as $status => $count) {
    echo "   {$status}: {$count}\n";
}

echo "\n3️⃣ Pending users analysis...\n";
echo "📊 Pending users found: " . count($pendingUsers) . "\n";

if (count($pendingUsers) > 0) {
    echo "\n📋 Pending users details:\n";
    foreach ($pendingUsers as $user) {
        echo "   • {$user['email']} ({$user['displayName']})\n";
        echo "     Requested: {$user['requestedAt']}\n";
    }
} else {
    echo "⚠️  NO PENDING USERS FOUND!\n";
    echo "\n🎯 ROOT CAUSE IDENTIFIED:\n";
    echo "   - No users are waiting for approval\n";
    echo "   - All users are already approved/rejected\n";
    echo "   - New registrations might not be setting status='pending'\n";
}

// Test 2: Check for users without status
echo "\n4️⃣ Checking for users without status...\n";
$noStatusCount = 0;
foreach ($users as $user) {
    $fields = $user['fields'] ?? [];
    if (!isset($fields['status'])) {
        $noStatusCount++;
        $email = $fields['email']['stringValue'] ?? 'unknown';
        echo "   • {$email} - missing status field\n";
    }
}

if ($noStatusCount > 0) {
    echo "⚠️  Found {$noStatusCount} users without status field\n";
} else {
    echo "✅ All users have status field\n";
}

// Test 3: Find admins
echo "\n5️⃣ Finding admin users...\n";
$adminCount = 0;
foreach ($users as $user) {
    $fields = $user['fields'] ?? [];
    $role = $fields['role']['stringValue'] ?? 'user';
    
    if ($role === 'admin') {
        $adminCount++;
        $email = $fields['email']['stringValue'] ?? 'unknown';
        $status = $fields['status']['stringValue'] ?? 'unknown';
        
        // Check permissions
        $manageUsers = false;
        if (isset($fields['permissions']['mapValue']['fields']['manageUsers']['booleanValue'])) {
            $manageUsers = $fields['permissions']['mapValue']['fields']['manageUsers']['booleanValue'];
        }
        
        echo "   👑 {$email} - status: {$status} - manageUsers: " . ($manageUsers ? '✅' : '❌') . "\n";
    }
}

echo "📊 Admin users: {$adminCount}\n";

// Summary
echo "\n📊 FINAL DIAGNOSIS:\n";
echo "==================\n";

if (count($pendingUsers) === 0) {
    echo "🎯 PROBLEM: NO PENDING USERS EXIST\n";
    echo "\n📝 SOLUTIONS:\n";
    echo "1. Check user registration process\n";
    echo "2. Verify new users get status='pending'\n";
    echo "3. Test with creating a manual pending user\n";
    echo "4. Check if Google OAuth users get proper status\n";
} else {
    echo "🎯 PROBLEM: PENDING USERS EXIST BUT APP CAN'T ACCESS THEM\n";
    echo "\n📝 CHECK:\n";
    echo "1. Firebase Security Rules\n";
    echo "2. Admin permissions in app\n";
    echo "3. AuthContext implementation\n";
    echo "4. UserApprovalPanel component\n";
}

echo "\n✅ Test completed!\n";
?>