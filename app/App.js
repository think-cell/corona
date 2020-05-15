import React, { Component } from 'react'
import {
  StyleSheet,
  Text,
  View,
  Button,
  ScrollView,
  Alert,
  AsyncStorage // TODO: replace by AsyncStorage from @react-native-community/async-storage
} from 'react-native'
import forge from "node-forge";

import NativeLib from 'react-native-native-lib';

export default class App extends Component {
  state = {
    atest : []
  }

  async componentDidMount() {
    const atest = await AsyncStorage.getItem("atest");
    if(atest) {
      this.setState({atest: JSON.parse(atest)});
    }
  }

  updatePersistentState(key, value) {
    this.setState({ [key]: value} )
    AsyncStorage.setItem(key, JSON.stringify(value));
  }

  render() {
	const backendRootUrl = "https://TODO/";
    const bytesToInt = bytes => new forge.jsbn.BigInteger(forge.util.bytesToHex(bytes), 16);
    return (
      <View style={{
        flex: 1,
        marginHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <ScrollView contentContainerStyle={{
          flex:1,
          justifyContent: 'center',
          alignItems: 'center'}}
        >
          {this.state.atest.map((test,index) => { return (
            <>
              <View>
                <Text style={styles.text}>
                  {test.pid}
                </Text>
                <Text style={styles.text}>
                  Created on {test.date.toLocaleString()}
                </Text>
                {(() => {
                  function changeTestState(stateHolder, index, state) {
                    let newState = stateHolder.state.atest.slice();
                    Object.assign(newState[index], state);
                    stateHolder.updatePersistentState("atest", newState );
                  }
                  async function onQueryButtonPress() {
                    const responseObj = await (
                      await fetch(backendRootUrl + "tests/" + test.pid)
                    ).json()
                    switch(responseObj.infected) {
                      case 1:
                      case true: {
                        // unblind
                        changeTestState(this, index, {
                          status: "positive",
                          hexSignature: (new forge.jsbn.BigInteger(responseObj.signature, 16)).multiply(
                            new forge.jsbn.BigInteger(test.hexInverseBlindingFactor, 16)
                          ).toString(16)
                        });
                        break;
                      }
                      case 0:
                      case false:
                        changeTestState(this, index, {status: "negative"});
                        break;
                      default:
                        changeTestState(this, index, {status: "noresult"});
                    }
                  }
                  switch(test.status) {
                    case 'pending':
                      return (
                        <View>
                          <Text style={styles.text}>
                            Status: Pending
                          </Text>
                          <View style={{ marginTop: 8 }}>
                            <Button title='Query' onPress={onQueryButtonPress.bind(this)} />
                          </View>
                        </View>
                      );
                    case 'noresult':
                      return (
                        <View>
                          <Text style={styles.text}>
                            Status: No result yet
                          </Text>
                          <View style={{ marginTop: 8 }}>
                            <Button title='Query' onPress={onQueryButtonPress.bind(this)} />
                          </View>
                        </View>
                      );
                    case 'negative':
                      return (
                        <View>
                          <Text style={[styles.text, {color: "green"}]}>
                            Status: Negative
                          </Text>
                        </View>
                      );
                    case 'positive':
                      return (
                        <View>
                          <Text style={[styles.text, {color: "red"}]}>
                            Positive
                          </Text>
                          <View style={{ marginTop: 8 }}>
                            <Button
                              title='Submit'
                              onPress={async () => {
                                if((await fetch(backendRootUrl + "infected", {
                                  method: "POST",
                                  body: "signature=" + test.hexSignature
                                    + "&auth_code=" + forge.util.bytesToHex(test.bytesAuthCode)
                                    + "&infected_ids=TODO"
                                })).ok) {
                                  changeTestState(this, index, {status: "submitted"});
                                }
                              }}
                            />
                          </View>
                        </View>
                      );
                    case 'submitted':
                      return (
                        <View>
                          <Text style={styles.text}>
                            Status: Submitted
                          </Text>
                        </View>
                      );
                  }
                })()}
                <View style={{ marginTop: 8 }}>
                  <Button
                    title='Delete' 
                    onPress={() => {
                      this.updatePersistentState("atest",
                        this.state.atest.slice(0,index)
                        .concat(this.state.atest.slice(index+1))
                      )
                    }}
                  />
                </View>
              </View>
              <View style={styles.separator} />
            </>
          ); })}
          <Button style={styles.button}
            title={'New Test '}
            onPress={async () => {
              const publicKey = forge.pki.publicKeyFromPem(
                await (
                  await fetch(backendRootUrl + "static/signature-public.pem")
                ).text()
              );
              const bytesAuthCode = forge.random.getBytesSync(16);
              const bytesBlindingFactor = forge.random.getBytesSync(16);
              let hashAuthCode = forge.md.sha512.create();
              hashAuthCode.update(bytesAuthCode);
              this.updatePersistentState("atest", this.state.atest.concat(
                [{
                  date: new Date(),
                  bytesAuthCode: bytesAuthCode,
                  // AsyncStorage cannot properly persist BigInteger. Use hex string instead.
                  hexInverseBlindingFactor: bytesToInt(bytesBlindingFactor).modInverse(publicKey.n).toString(16),
                  pid: await (
                    await fetch(backendRootUrl + "tests", {
                      method: "POST",
                      body: "signature_request=" + bytesToInt(hashAuthCode.digest().getBytes()).multiply(
                        bytesToInt(bytesBlindingFactor).modPow(publicKey.e, publicKey.n)
                      ).toString(16)
                    })
                  ).text(),
                  status: "pending"
                }]
              ));
            }}
          />
        </ScrollView>
        <Button
          title={"Test NativeLib"}
          onPress={() => {
			NativeLib.sampleMethod("test string ", 2, (str) => { 
			  this.setState({strNativeLibResponse: str});
			})
          }}
        />
        <Text style={styles.title}>
			{this.state.strNativeLibResponse}
        </Text>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    marginVertical: 8,
  },
  text: {
    textAlign: 'left',
    marginVertical: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#DDDDDD',
    padding: 10,
    marginBottom: 10,
  },
  separator: {
    marginVertical: 8,
    borderBottomColor: '#737373',
    borderBottomWidth: StyleSheet.hairlineWidth,
  }
});