// Script to identify and download correct Daily.co background thumbnails
// Run this in your browser console when in a Daily call

async function identifyDailyBackgrounds() {
  console.log('=== Daily Background Identification ===');
  
  // Test each background index and see what Daily actually shows
  const testIndices = [2, 3, 4, 5, 6, 7, 8, 9]; // Skip 1 (rollercoaster)
  
  for (const index of testIndices) {
    console.log(`\nTesting index ${index}:`);
    
    try {
      // Apply the background
      await dailyCall.updateInputSettings({
        video: {
          processor: {
            type: 'background-image',
            config: { source: index }
          }
        }
      });
      
      // Wait a moment for it to apply
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the actual thumbnail URL Daily uses
      const thumbnailUrl = `https://c.daily.co/call-ui/4f3f0bec8a9c9a5002aa0b94260cf08dc0ee8c5f/backgrounds/vb-${getBackgroundName(index)}-thumb.jpg`;
      console.log(`  Expected thumbnail: ${thumbnailUrl}`);
      
      // Create a link to download the correct thumbnail
      const link = document.createElement('a');
      link.href = thumbnailUrl;
      link.download = `daily-background-${index}-${getBackgroundName(index)}.jpg`;
      link.textContent = `Download ${getBackgroundName(index)} thumbnail`;
      link.style.display = 'block';
      link.style.margin = '5px 0';
      document.body.appendChild(link);
      
    } catch (error) {
      console.error(`  Failed to apply index ${index}:`, error);
    }
  }
  
  console.log('\n=== Download Links Added to Page ===');
  console.log('Click the links to download the correct thumbnails');
}

function getBackgroundName(index) {
  const names = {
    2: 'coffeeshop',
    3: 'forest', 
    4: 'library',
    5: 'lounge',
    6: 'office',
    7: 'palms',
    8: 'hills',
    9: 'ocean'
  };
  return names[index] || `unknown-${index}`;
}

// Run the identification
identifyDailyBackgrounds();
