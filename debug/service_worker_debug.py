#!/usr/bin/env python3
"""
Service Worker debugging script
Analyzuje proč Service Worker generuje tisíce "Failed to fetch" chyb
"""

import requests
import time
import json
from urllib.parse import urlparse

def analyze_service_worker_issue():
    """Analyzuje Service Worker problémy"""
    
    print("🛠️  Service Worker Debug Analysis")
    print("=" * 50)
    
    # Test Vercel deployment
    app_url = "https://brana-git-dev-ivan-vondraceks-projects.vercel.app"
    
    print(f"\n🌐 Testing main app: {app_url}")
    try:
        response = requests.get(app_url, timeout=10)
        print(f"✅ Main app status: {response.status_code}")
        
        # Check for service worker registration
        if 'service-worker.js' in response.text:
            print("🔍 Service Worker found in HTML")
        else:
            print("❓ Service Worker not found in HTML")
            
    except Exception as e:
        print(f"❌ Main app failed: {e}")
        return
    
    # Test service worker directly
    sw_url = f"{app_url}/service-worker.js"
    print(f"\n🔍 Testing Service Worker: {sw_url}")
    try:
        sw_response = requests.get(sw_url, timeout=10)
        print(f"✅ Service Worker status: {sw_response.status_code}")
        print(f"📏 Service Worker size: {len(sw_response.content)} bytes")
        
        # Analyze service worker content
        sw_content = sw_response.text
        
        print("\n📋 Service Worker Analysis:")
        if 'fetch(' in sw_content:
            print("✅ Contains fetch event listeners")
        if 'cache' in sw_content.lower():
            print("✅ Contains caching logic")
        if 'Failed to fetch' in sw_content:
            print("🚨 Contains 'Failed to fetch' strings")
        
        # Count fetch calls
        fetch_count = sw_content.count('fetch(')
        print(f"🔢 Fetch calls found: {fetch_count}")
        
        if fetch_count > 10:
            print("⚠️  HIGH NUMBER OF FETCH CALLS - potential loop!")
            
    except Exception as e:
        print(f"❌ Service Worker test failed: {e}")
    
    # Test problematic endpoints that might cause loops
    print(f"\n🎯 Testing problematic endpoints:")
    
    problem_endpoints = [
        f"{app_url}/api/camera-proxy/video",
        f"{app_url}/api/camera-proxy/stream.mjpg", 
        f"{app_url}/api/camera-proxy/photo.jpg",
        "https://89.24.76.191:10443/video",
        "https://89.24.76.191:10443/stream.mjpg"
    ]
    
    for endpoint in problem_endpoints:
        print(f"\n🔍 Testing: {endpoint}")
        try:
            start_time = time.time()
            response = requests.get(endpoint, timeout=3, stream=True)
            elapsed = time.time() - start_time
            
            print(f"  Status: {response.status_code}")
            print(f"  Time: {elapsed:.3f}s")
            
            # Check if this could cause service worker issues
            if response.status_code >= 500:
                print("  🚨 SERVER ERROR - could cause SW retry loop!")
            elif response.status_code == 404:
                print("  ⚠️  NOT FOUND - could cause SW issues")
            elif elapsed > 2:
                print("  ⏱️  SLOW RESPONSE - could cause timeouts")
            else:
                print("  ✅ OK")
                
        except requests.exceptions.Timeout:
            print("  ❌ TIMEOUT - major SW loop risk!")
        except requests.exceptions.ConnectionError:
            print("  ❌ CONNECTION ERROR - major SW loop risk!")
        except Exception as e:
            print(f"  💥 ERROR: {e}")

def recommendations():
    """Doporučení pro opravu Service Worker problémů"""
    
    print("\n" + "=" * 50)
    print("💡 DOPORUČENÍ PRO OPRAVU:")
    print("=" * 50)
    
    print("""
🔧 1. SERVICE WORKER LOOP FIX:
   - Přidej timeout limits do SW fetch events
   - Implementuj exponential backoff pro failed requests  
   - Přidaj blacklist pro problematické URLs

🔧 2. CAMERA ENDPOINT FIX:
   - Zkontroluj proč Vercel proxy vrací 500 errors
   - Implementuj circuit breaker pattern
   - Přidaj proper error handling

🔧 3. EMERGENCY FIX:
   - Dočasně vypni Service Worker caching pro camera endpointy
   - Přidaj max retry limits (např. 3 pokusy max)
   - Loguj všechny fetch failures pro debugging

🔧 4. MONITORING:
   - Přidaj SW error reporting
   - Monitor fetch failure rates
   - Alert při abnormal retry patterns
""")

def main():
    analyze_service_worker_issue()
    recommendations()

if __name__ == "__main__":
    main()