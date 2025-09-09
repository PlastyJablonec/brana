#!/usr/bin/env python3
"""
Diagnostický script pro testování všech camera endpointů
Testuje HTTP i HTTPS verze a analyzuje odpovědi
"""

import requests
import time
import sys
from urllib3.exceptions import InsecureRequestWarning
import warnings

# Potlač SSL warnings pro testování
warnings.simplefilter('ignore', InsecureRequestWarning)

def test_endpoint(url, timeout=5):
    """Test jednoho endpointu s kompletní analýzou"""
    print(f"\n🔍 Testuju: {url}")
    
    try:
        start_time = time.time()
        response = requests.get(
            url, 
            timeout=timeout, 
            verify=False,  # Ignore SSL for testing
            stream=True
        )
        response_time = time.time() - start_time
        
        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Response time: {response_time:.3f}s")
        print(f"📦 Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"📏 Content-Length: {response.headers.get('Content-Length', 'N/A')}")
        
        # Pokus o čtení prvních 100 bytů pro analýzu
        try:
            first_bytes = response.raw.read(100)
            print(f"🔤 First 20 bytes: {first_bytes[:20]}")
            
            # Detect content type by first bytes
            if first_bytes.startswith(b'\xff\xd8\xff'):
                print("📸 Detected: JPEG image")
            elif first_bytes.startswith(b'--'):
                print("🎥 Detected: MJPEG stream boundary")
            elif b'<html' in first_bytes.lower():
                print("📄 Detected: HTML page")
            else:
                print(f"❓ Unknown content type")
                
        except Exception as read_err:
            print(f"⚠️  Could not read content: {read_err}")
            
        return True, response.status_code, response_time
        
    except requests.exceptions.ConnectTimeout:
        print("❌ Connection timeout")
        return False, "timeout", timeout
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {e}")
        return False, "connection_error", 0
    except requests.exceptions.SSLError as e:
        print(f"🔒 SSL Error: {e}")
        return False, "ssl_error", 0
    except Exception as e:
        print(f"💥 Unexpected error: {e}")
        return False, "unknown_error", 0

def main():
    print("🚀 Camera Endpoint Diagnostic Tool")
    print("=" * 50)
    
    # Test všech endpointů
    endpoints = [
        # Vercel proxy (toto by mělo fungovat)
        "https://brana-git-dev-ivan-vondraceks-projects.vercel.app/api/camera-proxy/video",
        "https://brana-git-dev-ivan-vondraceks-projects.vercel.app/api/camera-proxy/stream.mjpg",
        "https://brana-git-dev-ivan-vondraceks-projects.vercel.app/api/camera-proxy/photo.jpg",
        
        # HTTPS přímé (problematické)
        "https://89.24.76.191:10443/video",
        "https://89.24.76.191:10443/stream.mjpg", 
        "https://89.24.76.191:10443/video.mjpg",
        "https://89.24.76.191:10443/photo.jpg",
        
        # HTTP přímé (pro srovnání - Mixed Content v HTTPS)
        "http://89.24.76.191:10180/video",
        "http://89.24.76.191:10180/stream.mjpg",
        "http://89.24.76.191:10180/video.mjpg", 
        "http://89.24.76.191:10180/photo.jpg",
    ]
    
    results = []
    
    for endpoint in endpoints:
        success, status, response_time = test_endpoint(endpoint)
        results.append({
            'endpoint': endpoint,
            'success': success,
            'status': status,
            'response_time': response_time
        })
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY:")
    print("=" * 50)
    
    working = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    print(f"✅ Working endpoints: {len(working)}/{len(results)}")
    for r in working:
        print(f"  ✅ {r['endpoint']} - {r['status']} ({r['response_time']:.3f}s)")
    
    print(f"\n❌ Failed endpoints: {len(failed)}/{len(results)}")
    for r in failed:
        print(f"  ❌ {r['endpoint']} - {r['status']}")
    
    # Recommendations
    print(f"\n💡 DOPORUČENÍ:")
    if len(working) > 0:
        print("🎯 Použij fungující endpoint jako primární")
        fastest = min(working, key=lambda x: x['response_time'])
        print(f"🚀 Nejrychlejší: {fastest['endpoint']} ({fastest['response_time']:.3f}s)")
    else:
        print("🚨 ŽÁDNÝ ENDPOINT NEFUNGUJE!")
        print("🔧 Zkontroluj:")
        print("   - Je camera server spuštěný?")
        print("   - Jsou porty 10180/10443 otevřené?")
        print("   - Funguje síťové připojení k 89.24.76.191?")

if __name__ == "__main__":
    main()