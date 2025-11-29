Apps implement achievement systems by defining achievements and their unlock conditions, integrating these achievements into the app's logic (often through events or polling), and then displaying achievements to the user. 
Here's a more detailed breakdown:
Defining Achievements:
Developers first define the achievements they want to offer, including their names, descriptions, icons, and the specific conditions required for unlocking. 
Achievements can be based on actions (e.g., completing a level, reaching a certain score), time spent in the app, or other criteria. 
Integrating Achievements into App Logic:
Events: The app can subscribe to specific events (e.g., level completion, button click) and check if the conditions for an achievement are met. 
Polling: The app can periodically check the game state or player progress to see if any achievements have been unlocked. 
Example: If an achievement requires a player to reach a score of 1000, the app would either subscribe to a "score updated" event or poll the player's score to check if it has reached 1000. 
Reporting Progress and Unlocking Achievements:
As the player makes progress, the app reports this progress to the achievement system, which then checks if any achievements have been unlocked. 
Once an achievement is unlocked, the app displays it to the user, often with a notification or in a dedicated achievements section. 
Server-Side Integration (Optional):
For achievements that require server-side verification or storage (e.g., for leaderboards or cloud syncing), the app can make API calls to a server to update achievement progress and unlock achievements. 
Example:
Consider an app where a player can earn achievements for completing levels, collecting items, or reaching certain scores. 
The app would:
Define these achievements with their respective conditions. 
Subscribe to events like "level completed" or "item collected". 
Check if the conditions for any achievements are met after these events occur. 
Report the achievement progress and unlock achievements accordingly. 
Display the achievements to the user. 


https://www.reddit.com/r/gamedev/comments/e0186r/how_did_you_implement_your_achievement_system/
https://stackoverflow.com/questions/2343538/implementation-of-achievement-systems-in-modern-complex-games
https://gamedev.stackexchange.com/questions/908/how-can-i-set-up-a-flexible-framework-for-handling-achievements