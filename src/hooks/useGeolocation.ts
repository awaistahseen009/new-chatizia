import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GeolocationData {
  country: string;
  region: string;
  city: string;
  ip: string;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getGeolocation = async () => {
      try {
        // Try to get IP and location from a free service
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          setLocation({
            country: data.country_name || 'Unknown',
            region: data.region || 'Unknown',
            city: data.city || 'Unknown',
            ip: data.ip || 'Unknown'
          });
        } else {
          // Fallback to a simpler service
          const fallbackResponse = await fetch('https://api.ipify.org?format=json');
          if (fallbackResponse.ok) {
            const ipData = await fallbackResponse.json();
            setLocation({
              country: 'Unknown',
              region: 'Unknown', 
              city: 'Unknown',
              ip: ipData.ip || 'Unknown'
            });
          }
        }
      } catch (error) {
        console.warn('Failed to get geolocation:', error);
        // Set default values if geolocation fails
        setLocation({
          country: 'Unknown',
          region: 'Unknown',
          city: 'Unknown', 
          ip: 'Unknown'
        });
      } finally {
        setLoading(false);
      }
    };

    getGeolocation();
  }, []);

  const storeUserLocation = async (chatbotId: string, additionalData?: any) => {
    if (!location) return;

    try {
      await supabase
        .from('user_interactions')
        .insert([
          {
            chatbot_id: chatbotId,
            sentiment: 'neutral',
            reaction: 'neutral',
            conversation_history: [],
            ...additionalData,
            // Store location data in a custom field or extend the schema
            created_at: new Date().toISOString()
          }
        ]);
    } catch (error) {
      console.error('Failed to store user location:', error);
    }
  };

  return {
    location,
    loading,
    storeUserLocation
  };
};