# Getting Started Guide for Complete Beginners

Welcome! This guide will walk you through setting up and running this React application step-by-step, even if you've never run a React app before. We'll cover both **Windows** and **Mac** operating systems.

---

## 📋 Prerequisites

Before you begin, you'll need to install a few tools on your computer. These are the same tools that professional developers use.

### For Mac Users

You'll need:
1. **Node.js** (version 20 or higher) - This lets your computer run JavaScript applications
2. **npm** (comes with Node.js) - This is a package manager that installs project dependencies
3. **A code editor** (optional but recommended) - We suggest [VS Code](https://code.visualstudio.com/) or [Cursor](https://cursor.sh/)

### For Windows Users

You'll need:
1. **Node.js** (version 20 or higher) - This lets your computer run JavaScript applications
2. **npm** (comes with Node.js) - This is a package manager that installs project dependencies
3. **A code editor** (optional but recommended) - We suggest [VS Code](https://code.visualstudio.com/) or [Cursor](https://cursor.sh/)

---

## 🔧 Step 1: Install Node.js and npm

### Mac Instructions

1. **Open your web browser** and go to: https://nodejs.org/
2. **Download the LTS version** (it will say "LTS" - this stands for Long Term Support and is the most stable version)
   - The website should automatically detect you're on a Mac and show you the Mac installer
   - Look for a file named something like `node-v20.x.x.pkg`
3. **Double-click the downloaded file** to open the installer
4. **Follow the installation wizard**:
   - Click "Continue" through the introduction
   - Accept the license agreement
   - Click "Install" (you may need to enter your Mac password)
   - Wait for the installation to complete
   - Click "Close" when finished
5. **Verify the installation**:
   - Open the **Terminal** app (you can find it by pressing `Cmd + Space` and typing "Terminal")
   - Type the following command and press Enter:
     ```bash
     node --version
     ```
   - You should see something like `v20.x.x` (the numbers might be different, but it should start with `v20` or higher)
   - Type this command and press Enter:
     ```bash
     npm --version
     ```
   - You should see something like `10.x.x` (the numbers might be different)

**✅ If you see version numbers for both commands, you're all set! Move to Step 2.**

**❌ If you get an error like "command not found", try closing and reopening Terminal, then try again. If it still doesn't work, make sure you completed the installation wizard.**

### Windows Instructions

1. **Open your web browser** and go to: https://nodejs.org/
2. **Download the LTS version** (it will say "LTS" - this stands for Long Term Support and is the most stable version)
   - The website should automatically detect you're on Windows and show you the Windows installer
   - Look for a file named something like `node-v20.x.x-x64.msi`
3. **Double-click the downloaded file** to open the installer
4. **Follow the installation wizard**:
   - Click "Next" on the welcome screen
   - Accept the license agreement and click "Next"
   - Keep the default installation location and click "Next"
   - Make sure "Add to PATH" is checked (it should be by default) and click "Next"
   - Click "Install" (you may need to allow the installer to make changes)
   - Wait for the installation to complete
   - Click "Finish" when done
5. **Verify the installation**:
   - Open **Command Prompt** or **PowerShell**:
     - Press `Windows Key + R`
     - Type `cmd` and press Enter (or type `powershell` for PowerShell)
   - Type the following command and press Enter:
     ```bash
     node --version
     ```
   - You should see something like `v20.x.x` (the numbers might be different, but it should start with `v20` or higher)
   - Type this command and press Enter:
     ```bash
     npm --version
     ```
   - You should see something like `10.x.x` (the numbers might be different)

**✅ If you see version numbers for both commands, you're all set! Move to Step 2.**

**❌ If you get an error like "'node' is not recognized", try closing and reopening Command Prompt/PowerShell, then try again. If it still doesn't work, restart your computer and try once more.**

---

## 📁 Step 2: Get the Project Files

You need to have the project files on your computer. If you're reading this, you probably already have them! But just to be sure:

1. **Make sure you're in the project folder**:
   - On **Mac**: Open Terminal and navigate to the project folder using `cd` command:
     ```bash
     cd /Users/gavinolsen/Desktop/rpm/fndr
     ```
     (Replace the path with wherever you saved the project)
   - On **Windows**: Open Command Prompt or PowerShell and navigate to the project folder:
     ```bash
     cd C:\path\to\fndr
     ```
     (Replace the path with wherever you saved the project)

2. **Verify you're in the right place**:
   - Type this command and press Enter:
     ```bash
     dir
     ```
     (On Mac, use `ls` instead)
   - You should see files like `package.json`, `README.md`, and folders like `apps` and `libs`

---

## 📦 Step 3: Install Project Dependencies

This project uses many code libraries (called "dependencies") that need to be downloaded before you can run the app. This is like installing all the parts needed to build something.

### For Both Mac and Windows:

1. **Make sure you're in the project folder** (see Step 2 if you're not sure)
2. **Run this command**:
   ```bash
   npm install
   ```
3. **Wait for it to finish** - This might take 2-5 minutes. You'll see lots of text scrolling by. This is normal!
   - You'll see messages like "added 500 packages" or similar
   - When it's done, you'll see your command prompt again (you'll be able to type new commands)

**✅ Success looks like**: You see your command prompt again, and there's a new folder called `node_modules` in your project directory.

**❌ If you see errors**: 
   - Make sure you have an internet connection
   - Try running `npm install` again
   - If you see permission errors on Mac, you might need to use `sudo npm install` (but this is usually not necessary)

---

## 🚀 Step 4: Run the Application

This project has two parts that need to run at the same time:
1. **Backend** - The server that processes data
2. **Frontend** - The website you'll see in your browser

You need to open **two separate terminal/command prompt windows** (one for each part).

### Mac Instructions

#### Terminal Window 1 - Start the Backend:

1. **Open Terminal** (if you don't have it open already)
2. **Navigate to the project folder**:
   ```bash
   cd /Users/gavinolsen/Desktop/rpm/fndr
   ```
3. **Start the backend**:
   ```bash
   npm run start:backend
   ```
4. **Wait for it to start** - You'll see messages like "Server running on port 3001" or similar
5. **Leave this window open** - Don't close it! The backend needs to keep running.

#### Terminal Window 2 - Start the Frontend:

1. **Open a NEW Terminal window**:
   - Press `Cmd + T` in your existing Terminal window, OR
   - Go to Terminal menu → New Window, OR
   - Open Terminal app again
2. **Navigate to the project folder** (same as before):
   ```bash
   cd /Users/gavinolsen/Desktop/rpm/fndr
   ```
3. **Start the frontend**:
   ```bash
   npm run start:frontend
   ```
4. **Wait for it to start** - You'll see messages like "Local: http://localhost:3000" or similar
5. **Your browser should automatically open** to `http://localhost:3000`
   - If it doesn't open automatically, open your browser and go to: `http://localhost:3000`

### Windows Instructions

#### Command Prompt/PowerShell Window 1 - Start the Backend:

1. **Open Command Prompt or PowerShell** (if you don't have it open already)
2. **Navigate to the project folder**:
   ```bash
   cd C:\path\to\fndr
   ```
   (Replace with your actual project path)
3. **Start the backend**:
   ```bash
   npm run start:backend
   ```
4. **Wait for it to start** - You'll see messages like "Server running on port 3001" or similar
5. **Leave this window open** - Don't close it! The backend needs to keep running.

#### Command Prompt/PowerShell Window 2 - Start the Frontend:

1. **Open a NEW Command Prompt or PowerShell window**:
   - Right-click on Command Prompt/PowerShell in your taskbar and select "New Window", OR
   - Press `Windows Key`, type "cmd" or "powershell", and open a new one
2. **Navigate to the project folder** (same as before):
   ```bash
   cd C:\path\to\fndr
   ```
   (Replace with your actual project path)
3. **Start the frontend**:
   ```bash
   npm run start:frontend
   ```
4. **Wait for it to start** - You'll see messages like "Local: http://localhost:3000" or similar
5. **Open your web browser** and go to: `http://localhost:3000`

---

## ✅ What You Should See

When everything is working correctly:

1. **Backend window** shows: The server is running and listening on port 3001
2. **Frontend window** shows: The development server is running and the app is available at `http://localhost:3000`
3. **Your browser** shows: The React application interface

You should now be able to interact with the application in your browser!

---

## 🛑 How to Stop the Application

When you're done using the application:

1. **Go to each terminal/command prompt window**
2. **Press `Ctrl + C`** (on both Mac and Windows) in each window
3. **Confirm by pressing `Ctrl + C` again** if it asks you to
4. **Close the terminal windows** when you're done

---

## ❓ Troubleshooting

### Problem: "command not found" or "'npm' is not recognized"

**Solution**: Node.js isn't installed or isn't in your PATH. Go back to Step 1 and make sure you:
- Completed the full installation wizard
- Restarted your terminal/command prompt (or restarted your computer)
- Verified with `node --version` and `npm --version`

### Problem: "Port 3000 is already in use" or "Port 3001 is already in use"

**Solution**: Another application is using that port. You can either:
- Close the other application using that port
- Or, if you have another instance of this app running, close those terminal windows first

### Problem: The browser shows "This site can't be reached" or "Connection refused"

**Solution**: 
- Make sure BOTH the backend AND frontend are running (you need two terminal windows open)
- Make sure you're going to `http://localhost:3000` (not `https://`)
- Check that the backend window shows it's running on port 3001
- Check that the frontend window shows it's running on port 3000

### Problem: "npm install" takes forever or fails

**Solution**:
- Make sure you have a stable internet connection
- Try running `npm install` again
- If you're behind a corporate firewall, you might need to configure npm proxy settings (ask your IT department)

### Problem: On Mac, you get "permission denied" errors

**Solution**: 
- Try running commands without `sudo` first (you usually don't need it)
- If you must use `sudo`, be very careful - only use it if you understand what you're doing
- Consider fixing npm permissions instead: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

### Problem: On Windows, the terminal closes immediately after showing an error

**Solution**:
- Open Command Prompt or PowerShell manually (don't double-click a .bat file)
- This way the window will stay open so you can see the error message

---

## 🎉 You're All Set!

If you've made it this far and the app is running in your browser, congratulations! You've successfully set up and run a React application. 

**Remember**: 
- Keep both terminal/command prompt windows open while using the app
- Use `Ctrl + C` to stop the servers when you're done
- You'll need to run `npm run start:backend` and `npm run start:frontend` each time you want to use the app

---

## 📚 Next Steps

Now that you have the app running, you can:
- Explore the application in your browser
- Make changes to the code (if you're learning to code)
- Check out the main `README.md` file for more technical details about the project

Happy coding! 🚀
