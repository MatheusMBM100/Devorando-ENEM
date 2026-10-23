import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from classificar import *
Q=carregar("data.js","["); EXP=carregar("explicacoes.js","{")
mp=os.path.join(ROOT,"build","classificacao_manual.json")
man=json.load(open(mp)) if os.path.exists(mp) else {}
area=sys.argv[1]; ini=int(sys.argv[2]); fim=int(sys.argv[3])
sel=[q for q in Q if q["area"]==area][ini:fim]
for q in sel:
    m=classificar(q,EXP,man)
    e=EXP.get(q["id"],{}).get("certa","")[:105].replace("\n"," ")
    print(q["id"][2:],m[0][:4],"|",e)
