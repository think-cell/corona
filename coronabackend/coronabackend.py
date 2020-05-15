#!/usr/bin/env python3

from bottle import run, get, post, request, abort, static_file, response, route
from datetime import datetime
import sqlite3
import secrets
from email.mime.text import MIMEText
import smtplib
from Crypto.PublicKey import RSA
import hashlib
import base64
import string

# setup:

# create the database infections.db and create tables:
# create table tests (pid char(40) primary key not null, signature_request not null, infected integer, date date, user text);
# create table requests (sid char(64) primary key not null, pid char(40) not null, user text not null);
# create table users(user text primary key not null);

# install dependencies pcryptodome, cheroot

# adapt server url:
backend_root_url = "https://TODO.com/"
mail_smtp_address = "mail.TODO.com"
mail_sender_address = "TODO@TODO.com"

# provide ssl certificate for this url:
ssl_certfile = "ssl-fullchain.pem"
ssl_keyfile = "ssl-privkey.pem"

# create signature certificates and store them as signature-private.pem and static/signature-public.pem
private_key = RSA.importKey(open("signature-private.pem", "rb").read())


def render_feedback(content):
	return '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">' \
			'<html xmlns="http://www.w3.org/1999/xhtml"><body>' \
			'<p>' + content + '</p>' \
			'<p><a href=" / ">Submit another ID</a></p>' \
			'</body></html>'


@get('/static/<filename>')
def server_static(filename):
	return static_file(filename, root='./static')


@get('/')
@get('/index.html')
def form_page():
	return server_static("index.html")


@post('/')
@post('/index.html')
def form_page():
	pid = request.forms.get('pid')
	user = request.forms.get('user')
	if pid is not None and user is not None:
		pid_raw = "".join([ch for ch in pid if ch in string.ascii_letters+string.digits])
		connection = sqlite3.connect('infections.db')
		if connection.execute("SELECT user FROM users WHERE user=?", (user,)).fetchone() is None:
			msg = email.mime.text.MIMEText(
				"You are not yet registered with our system. You can apply for a registration at ..."
			)
			msg['Subject'] = "User not found"
		elif connection.execute("SELECT pid FROM tests WHERE pid=?", (pid_raw,)).fetchone() is None:
			msg = email.mime.text.MIMEText(
				"Patient is not registered for a test."
			)
			msg['Subject'] = "Test not found"
		else:
			sid = secrets.token_urlsafe()
			connection.execute("INSERT INTO requests(sid,pid,user) VALUES(?,?,?)", (sid, pid_raw, user))
			connection.commit()

			url = backend_root_url + "confirm-infection/" + sid
			msg = MIMEText(
				"<html><body><p>Please confirm your submitted infection by visiting the following page:</p>"
				"<p><a href='" + url + "'>" + url + "</a></body></html>",
				"html"
			)
			msg['Subject'] = "Please confirm your submission"
		msg['From'] = mail_sender_address
		msg['To'] = user
		with smtplib.SMTP(mail_smtp_address) as s:
			s.send_message(msg)
		return render_feedback("Please check your inbox!")
	else:
		abort(400, "missing parameters")


# cannot use post here, because this is the target of by an email link
@get('/confirm-infection/<sid>')
def confirm_infection(sid):
	connection = sqlite3.connect('infections.db')
	row = connection.execute("SELECT pid, user FROM requests WHERE sid=?", (sid,)).fetchone()
	if row is None:
		abort(404, "not found")
	else:
		try:
			connection.execute("DELETE FROM requests WHERE sid=?", (sid,))
			connection.execute(
				"UPDATE tests SET infected=1, date=?, user=? WHERE pid=?",
				(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), row[1], row[0])
			)
			connection.commit()
			return render_feedback("Submission successful. Thank you!")
		except sqlite3.Error as e:
			abort(400, "bad parameter")


@post('/tests')
def post_test():
	signature_request = request.forms.get('signature_request')
	if signature_request is not None:
		try:
			int(signature_request, 16)
		except ValueError:
			abort(400, "bad parameter")
		connection = sqlite3.connect('infections.db')
		row = connection.execute("SELECT pid FROM tests WHERE signature_request=?", (signature_request,)).fetchone()
		if row is None:
			pid = base64.b32encode(secrets.token_bytes(16))[:25].replace(b'O', b'8').replace(b'I', b'9').decode("ascii")
			connection.execute("INSERT INTO tests VALUES(?,?,null,null,null)", (pid, signature_request))
			connection.commit()
			return "-".join([pid[i:i+5] for i in range(0, len(pid), 5)])
		else:
			return row[0]
	else:
		abort(400, "missing parameters")


@get('/tests/<pid>')
def get_test(pid):
	pid_raw = "".join([ch for ch in pid if ch!="-"])
	connection = sqlite3.connect('infections.db')
	row = connection.execute("SELECT signature_request, infected, date FROM tests WHERE pid=?", (pid_raw,)).fetchone()
	if row is None:
		abort(404, "not found")
	else:
		return {
			"signature": format(
				pow(
					int(row[0], 16),
					private_key.d,
					private_key.n
				),  # sign request
				'x'
			),
			"infected": row[1],
			"report_date": row[2]
		}

@post('/infected')
def post_infected():
	infected_ids = request.forms.get('infected_ids')
	auth_code = request.forms.get('auth_code')
	signature = request.forms.get('signature')
	if infected_ids is not None and auth_code is not None and signature is not None:
		try:
			auth_code_hash = int(hashlib.sha512(bytearray.fromhex(auth_code)).hexdigest(), 16)
			signature_check = pow(int(signature, 16), private_key.e, private_key.n)
			if auth_code_hash==signature_check:
				print(infected_ids)
			else:
				abort(400, "bad parameter")
		except ValueError:
			abort(400, "bad parameter")
	else:
		abort(400, "missing parameters")


run(host="0.0.0.0", port=8081, debug=True, server="cheroot", certfile=ssl_certfile, keyfile=ssl_keyfile)
