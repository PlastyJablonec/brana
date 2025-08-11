const express = require('express');
const mqtt = require('mqtt');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

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
    return mqttClient;
  }

  isConnecting = true;
  console.log('DEV MQTT Proxy: Attempting to connect to ws://89.24.76.191:9001');
  
  try {
    mqttClient = mqtt.connect('ws://89.24.76.191:9001', {
      clientId: `dev-proxy-${Math.random().toString(16).substring(2, 8)}`,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      keepalive: 60
    });

    mqttClient.on('connect', () => {
      console.log('DEV MQTT Proxy: ✅ Connected to broker successfully');
      isConnecting = false;
      
      mqttClient.subscribe(['IoT/Brana/Status', 'IoT/Brana/Status2', 'Log/Brana/ID'], { qos: 1 }, (err) => {
        if (err) {
          console.error('DEV MQTT Proxy: Subscribe error:', err);
        } else {
          console.log('DEV MQTT Proxy: ✅ Subscribed to status topics and activity log');
        }
      });
    });

    mqttClient.on('message', (topic, message) => {
      const messageStr = message.toString();
      console.log(`DEV MQTT Proxy: 📨 Message received: ${topic} = ${messageStr}`);
      lastMessages[topic] = messageStr;
    });

    mqttClient.on('error', (error) => {
      console.error('DEV MQTT Proxy: ❌ Connection error:', error);
      isConnecting = false;
    });

    mqttClient.on('close', () => {
      console.log('DEV MQTT Proxy: 🔌 Connection closed');
      isConnecting = false;
    });

  } catch (error) {
    console.error('DEV MQTT Proxy: ❌ Setup error:', error);
    isConnecting = false;
  }

  return mqttClient;
}

// API endpoints
app.get('/api/mqtt-proxy', (req, res) => {
  const client = connectToMqtt();
  
  if (!client) {
    res.status(503).json({ 
      connected: false, 
      error: 'MQTT client not initialized',
      messages: lastMessages
    });
    return;
  }

  res.json({ 
    connected: client.connected,
    status: 'DEV MQTT Proxy Active',
    clientId: client.options?.clientId,
    messages: lastMessages,
    isConnecting: isConnecting
  });
});

app.post('/api/mqtt-proxy', (req, res) => {
  const client = connectToMqtt();
  const { topic, message } = req.body;
  
  if (!client) {
    res.status(503).json({ error: 'MQTT client not initialized' });
    return;
  }

  console.log(`DEV MQTT Proxy: Publishing to ${topic}: ${message} (connected: ${client.connected})`);
  
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error('DEV MQTT Proxy: Publish error:', err);
      res.status(500).json({ error: 'Publish failed', details: err.message });
    } else {
      console.log(`DEV MQTT Proxy: ✅ Successfully published to ${topic}: ${message}`);
      res.json({ success: true, topic, message, connected: client.connected });
    }
  });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`🚀 DEV MQTT Proxy server running on http://localhost:${PORT}`);
  console.log('📡 Connecting to MQTT broker...');
  connectToMqtt();
});