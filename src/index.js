import "./cadesplugin_api";

class CadesUtils {
  static CADESCOM_CADES_BES = 1;
  static CAPICOM_CURRENT_USER_STORE = 2;
  static CAPICOM_MY_STORE = "My";
  static CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
  static CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
  static STORE_OBJECT_NAME = "CAdESCOM.Store";
  static CADESCOM_CADES_X_LONG_TYPE_1 = 0x5d;
  static CADESCOM_BASE64_TO_BINARY = 1;

  static createObject(name) {
    return !!window.cadesplugin.CreateObjectAsync
      ? window.cadesplugin.CreateObjectAsync(name)
      : new Promise((resolve, reject) => {
          const obj = window.cadesplugin.CreateObject(name);
          resolve(obj);
        });
  }

  static openStore(store, ...params) {
    return new Promise((resolve, reject) => {
      if (!window.cadesplugin.CreateObjectAsync) {
        store.Open.apply(this, params);
        resolve(store);
      } else {
        store.Open.apply(this, params).then(() => resolve(store));
      }
    });
  }

  static getCertsObjFromOpenStore(store) {
    return new Promise((resolve, reject) => {
      if (!!window.cadesplugin.CreateObjectAsync) {
        return store.Certificates.then(obj => {
          return obj.Find(
            CadesUtils.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
            ""
          );
        }).then(certs => {
          resolve(certs);
        });
      } else {
        return resolve(
          store.Certificates.Find(
            CadesUtils.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
            ""
          )
        );
      }
    });
  }

  static getCountFromCerts(certs) {
    return new Promise((resolve, reject) => {
      if (!!window.cadesplugin.CreateObjectAsync) {
        certs.Count.then(count => resolve(count));
      } else {
        resolve(certs.Count);
      }
    });
  }

  static getCompanyNameFromSubject(subj) {
    return CadesUtils.getByTagFromSubject(subj, "O");
  }

  static getNameFromSubject(subj) {
    let name = "";

    name = `${CadesUtils.getByTagFromSubject(subj, "SN")} `;
    name += CadesUtils.getByTagFromSubject(subj, "G");
    name = name.trim();

    if (!name.length) {
      name = CadesUtils.getByTagFromSubject(subj, "CN");
    }

    return name;
  }

  static getByTagFromSubject(subj, tag) {
    const splitted = subj.split(",");
    let val = "";
    splitted.forEach(sp => {
      const spl = sp.split("=");
      if (spl[0].trim() === tag) val = spl[1].trim();
    });
    return val;
  }

  static getCertsByCount(certs, count) {
    return new Promise((resolve, reject) => {
      if (!!window.cadesplugin.CreateObjectAsync) {
        const promises = [];
        for (let i = 1; i < count + 1; i++) {
          promises.push(certs.Item(i));
        }
        Promise.all(promises).then(certificates => {
          const namePromises = [];
          const fromPromises = [];
          const toPromises = [];
          const serialPromises = [];
          const validPromises = [];
          const thumbprintPromises = [];

          certificates.forEach(c => {
            namePromises.push(c.SubjectName);
            fromPromises.push(c.ValidFromDate);
            toPromises.push(c.ValidToDate);
            serialPromises.push(c.SerialNumber);
            validPromises.push(c.IsValid());
            thumbprintPromises.push(c.Thumbprint)
          });

          Promise.all(
            [namePromises, fromPromises, toPromises, serialPromises, validPromises, thumbprintPromises].map(c =>
              Promise.all(c)
            )
          ).then(names => {
            const isValid = [];
              names[4].forEach(n => {
                isValid.push(n.Result)
              });
              Promise.all(isValid).then(results => {
                names[4] = results;
                  resolve(
                      certificates.map((c, i) => {
                          return { certificate: c, info: names.map(info => info[i]) };
                      })
                  );
              })
          });
        });
      } else {
        // console.log('here parse it certs');
        // console.log('certs', certs);
        // console.log('count', count);
        // const cert = certificatesList.Item(i);
        // signaturesObjList.push(cert);
        //
        // model.signaturesList.push({
        //   company: parseCert(cert.SubjectName, 'O'),
        //   email: parseCert(cert.SubjectName, 'E'),
        //   fromDate: new Date(cert.ValidFromDate),
        //   toDate: new Date(cert.ValidToDate),
        //   name: getNameFromCertificate(cert.SubjectName)
        // });
      }
    });
  }

  static getAsyncCertArray() {
    return new Promise((resolve, reject) => {
      CadesUtils.init()
        .then(() => {
          return CadesUtils.createObject(CadesUtils.STORE_OBJECT_NAME);
        })
        .then(store => {
          return CadesUtils.openStore(
            store,
            CadesUtils.CAPICOM_CURRENT_USER_STORE,
            CadesUtils.CAPICOM_MY_STORE,
            CadesUtils.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
          );
        })

        .then(store => {
          CadesUtils.getCertsObjFromOpenStore(store)
            .then(certs =>
              CadesUtils.getCountFromCerts(certs).then(count =>
                CadesUtils.getCertsByCount(certs, count)
              )
            )
            .then(certificates => {
              store.Close();
              resolve(certificates);
            });
        })
        .catch(err => reject(err));
    });
  }

  static getSyncCertArray() {

    return new Promise((resolve, reject) => {
      const oStore = window.cadesplugin.CreateObject("CAdESCOM.Store");
      oStore.Open(
        CadesUtils.CAPICOM_CURRENT_USER_STORE,
        CadesUtils.CAPICOM_MY_STORE,
        CadesUtils.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
      );

      const oCertificates = oStore.Certificates.Find(
        CadesUtils.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
        ""
      );

      if (oCertificates.Count === 0) {
        alert("Certificate not found");
        return resolve([]);
      }

      const certs = [];

      for (let i = 1; i <= oCertificates.Count; i++) {
        var cert = oCertificates.Item(i);

        certs.push({
          certificate: cert,
          info: [
            cert.SubjectName,
            cert.ValidFromDate,
            cert.ValidToDate,
            cert.SerialNumber
          ]
        });
      }
      //oStore.Close();
      resolve(certs);
    });
  }

  static getFinalCertsArray() {
    if (!!window.cadesplugin.CreateObjectAsync) {
      return CadesUtils.getAsyncCertArray();
    } else {
      return CadesUtils.getSyncCertArray();
    }
  }

  static signMessageAsync(message, cert, detached) {
    return new Promise((resolve, reject) => {
      window.cadesplugin
        .CreateObjectAsync("CAdESCOM.CPSigner")
        .then(oSigner => {
          oSigner
            .propset_Certificate(cert)
            .then(() => {
              return window.cadesplugin.CreateObjectAsync(
                "CAdESCOM.CadesSignedData"
              );
            })
            .then(oSignedData => {
              oSignedData
                .propset_Content(message)
                .then(() => {
                  return oSignedData.SignCades(
                    oSigner,
                    CadesUtils.CADESCOM_CADES_BES,
                    detached
                  );
                })
                .then(msg => {
                  resolve(msg);
                });
            });
        });
    });
  }

  static isActiveX() {
    try {
      new window.ActiveXObject("CAdESCOM.store");
      return true;
    } catch (e) {
      return false;
    }
  }

  static signMessageSync(message, cert, detached) {
    return new Promise((resolve, reject) => {
      window.cadesplugin.CADESCOM_ENCODE_BASE64 = 1;
      const CADESCOM_CADES_BES = 1;

      const oSigner = window.cadesplugin.CreateObject("CAdESCOM.CPSigner");
      oSigner.Certificate = cert;
      const oSignedData = window.cadesplugin.CreateObject(
        "CAdESCOM.CadesSignedData"
      );

      if (detached) {
        oSignedData.ContentEncoding = this.CADESCOM_BASE64_TO_BINARY;
      }

      oSignedData.Content = message;

      try {
        const signed = oSignedData.SignCades(
          oSigner,
          CADESCOM_CADES_BES,
          detached
        );
        resolve(signed);
      } catch (e) {
        console.log("error", JSON.stringify(e));
      }
    });
  }

  static signMessage(message, cert, detached = false) {
    if (!!window.cadesplugin.CreateObjectAsync) {
      return CadesUtils.signMessageAsync(message, cert, detached);
    } else {
      return CadesUtils.signMessageSync(message, cert, detached);
    }
  }

  static init() {
    return new Promise((resolve, reject) => {
      if (!!window.cadesplugin.CreateObjectAsync) {
        window.cadesplugin.then(
          function() {
            resolve();
          },
          function(error) {
            reject(error);
          }
        );
      } else {
        window.addEventListener(
          "message",
          function(event) {
            if (event.data === "cadesplugin_loaded") {
              resolve();
            } else if (event.data === "cadesplugin_load_error") {
              reject(event);
            }
          },
          false
        );
        window.postMessage("cadesplugin_echo_request", "*");
      }
    });
  }
}

export default CadesUtils;
export { CadesUtils };
