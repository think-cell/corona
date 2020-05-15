# Corona App and Backend

This is a proposal and proof-of-concept to support the development of COVID-19 exposure notification apps. 

## Approach

Currently our focus is on the mechanism for health authorities to report infections. We propose and implemented the following mechanism:

1. When going to the hospital / test center the app user registers with the backend for the test. The app receives a test id.

2. The doctor taking the test notes the test id and attaches it to the test sample. In the future this could be facilitated by the app showing a QR code, which would be scanned by the doctor to print the test id.

3. If the sample is tested positive in the lab, the lab worker enters the test id into a website provided by the backend. She authenticates with her email address.

4. The app queries the server for the test status. If positive, it receives an authorization code, and the user is notified. 
The user gets notified about an infection as soon as it is detected, without delay.

5. If the user decides to upload her keys, the authorization code is also submitted and checked by the backend.

In order to preserve privacy it must be impossible to link the user/patient identity to her uploaded keys, even if health authorities and backend collude. We support this by implementing blind signatures as described in https://github.com/DP-3T/documents/issues/210

This protocol requires a basic authentication scheme between health authorities and the backend. For simplicity, we require the HA email address to be registered at the backend (entry in the users table). The lab worker then enters this email address and receives a confirmation link to finalize the report.

The code consists of two components:

## App

The app was build using React Native, facilitating quick cross platform development. The application logic can be found in App.js. In addition, all React Native scaffolding was checked in. You have to adapt backendRootUrl to point to your URL where you host the backend server.

The UI is very minimalistic and allows to test the basic functionality: 

* register a new test, get the test ID from the server and show it in the app
* query the status of the test
* in case of a positive test:
  * get the blind signature
  * unblind it to generate the authorization
  * submit the authorization along with the payload (future tracking keys) to the backend
  
The app also includes a sample native component where the Google/Apple exposure notification API can be implemented.


## Backend

The backend server was built with Python using [Bottle (dev)](https://bottlepy.org/docs/dev/) and [Cheroot](https://pypi.org/project/cheroot/). The server logic can be found in coronabackend.py. In order to run the server you have to provide some settings as described in coronabackend.py:

* set the backend root url, where you host the backend server
* provide a mail server and sender address to send authentication emails
* provide your own HTTPS certificates

We provided test signature*.pem files to test the blind signature functionality.

