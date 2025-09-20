const mqtt = require('mqtt');

// Global MQTT client to maintain connection
let mqttClient = null;
let isConnecting = false;
let lastMessages = {
  'IoT/Brana/Status': null,
  'IoT/Brana/Status2': null,
  'Log/Brana/ID': null
};

function connectToMqtt() {
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  if (isConnecting) {
    return mqttClient; // Return existing client even if connecting
  }

  isConnecting = true;
  console.log('MQTT Proxy: Attempting to connect to ws://89.24.76.191:9001 (external IP)');

  try {
    mqttClient = mqtt.connect('ws://89.24.76.191:9001', {
      clientId: `proxy-${Math.random().toString(16).substring(2, 8)}`,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      keepalive: 60
    });

    mqttClient.on('connect', () => {
      console.log('MQTT Proxy: ✅ Connected to broker successfully');
      isConnecting = false;

      // Subscribe to status topics AND activity log
      mqttClient.subscribe(['IoT/Brana/Status', 'IoT/Brana/Status2', 'Log/Brana/ID'], { qos: 1 }, (err) => {
        if (err) {
          console.error('MQTT Proxy: Subscribe error:', err);
        } else {
          console.log('MQTT Proxy: ✅ Subscribed to status topics and activity log');
        }
      });
    });

    mqttClient.on('message', (topic, message) => {
      const messageStr = message.toString();
      console.log(`MQTT Proxy: 📨 Message received: ${topic} = ${messageStr}`);
      lastMessages[topic] = messageStr;
    });

    mqttClient.on('error', (error) => {
      console.error('MQTT Proxy: ❌ Connection error:', error);
      isConnecting = false;
    });

    mqttClient.on('close', () => {
      console.log('MQTT Proxy: 🔌 Connection closed');
      isConnecting = false;
    });

    mqttClient.on('reconnect', () => {
      console.log('MQTT Proxy: 🔄 Reconnecting...');
    });

  } catch (error) {
    console.error('MQTT Proxy: ❌ Setup error:', error);
    isConnecting = false;
  }

  return mqttClient;
}

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('MQTT Proxy: Request received', req.method, req.url);

  // Always try to connect (or get existing connection)
  const client = connectToMqtt();
  
  // Give some time for connection to establish if needed
  if (client && !client.connected && isConnecting) {
    console.log('MQTT Proxy: Client connecting, waiting a moment...');
  }

  if (req.method === 'POST') {
    // Handle MQTT publish commands
    const { topic, message } = req.body;
    
    if (!client) {
      console.error('MQTT Proxy: No client available for publish');
      res.status(503).json({ error: 'MQTT client not initialized' });
      return;
    }

    // If not connected, try to publish anyway - MQTT client handles queuing
    console.log(`MQTT Proxy: Attempting to publish to ${topic}: ${message} (connected: ${client.connected})`);
    
    client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error('MQTT Proxy: Publish error:', err);
        res.status(500).json({ error: 'Publish failed', details: err.message });
      } else {
        console.log(`MQTT Proxy: ✅ Successfully published to ${topic}: ${message}`);
        res.status(200).json({ success: true, topic, message, connected: client.connected });
      }
    });
    return;
  }

  if (req.method === 'GET') {
    // Return current status and messages
    if (!client) {
      res.status(503).json({ 
        connected: false, 
        error: 'MQTT client not initialized',
        messages: lastMessages
      });
      return;
    }

    res.status(200).json({ 
      connected: client.connected,
      status: 'MQTT Proxy Active via HTTP',
      clientId: client.options?.clientId,
      messages: lastMessages,
      isConnecting: isConnecting
    });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}