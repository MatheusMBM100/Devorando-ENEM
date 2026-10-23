"""Grava classificações manuais: python3 build/aplicar.py AREA INICIO "cod cod ..." (na mesma ordem de build/rev.py)."""
import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from classificar import carregar, ROOT
COD={
 "H1":("História","Brasil Colônia e Império"),"H2":("História","Brasil República"),"H3":("História","História Geral"),
 "G1":("Geografia","Geografia física e meio ambiente"),"G2":("Geografia","Geografia humana, urbana e econômica"),
 "F":("Filosofia","Filosofia"),"S":("Sociologia","Sociedade, cultura e política"),
 "PI":("Língua Portuguesa","Interpretação de texto"),"PV":("Língua Portuguesa","Variação linguística"),
 "PF":("Língua Portuguesa","Funções da linguagem e recursos expressivos"),"PG":("Língua Portuguesa","Gêneros textuais e argumentação"),
 "PC":("Língua Portuguesa","Coesão, coerência e gramática"),"PM":("Língua Portuguesa","Mídias e tecnologia"),
 "LP":("Literatura","Poesia"),"LR":("Literatura","Prosa e escolas literárias"),
 "AV":("Artes","Artes visuais"),"AM":("Artes","Música, dança e teatro"),"EF":("Educação Física","Corpo, esporte e saúde"),
 "EN":("Inglês","Interpretação de texto"),"ES":("Espanhol","Interpretação de texto"),
 "FE":("Física","Eletricidade e magnetismo"),"FM":("Física","Mecânica"),"FT":("Física","Termologia e termodinâmica"),"FO":("Física","Ondas, óptica e física moderna"),
 "QO":("Química","Química orgânica"),"QE":("Química","Estequiometria e soluções"),"QR":("Química","Reações, equilíbrio e termoquímica"),"QA":("Química","Eletroquímica e química do ambiente"),
 "BG":("Biologia","Genética e biotecnologia"),"BE":("Biologia","Ecologia e meio ambiente"),"BV":("Biologia","Evolução e diversidade dos seres vivos"),
 "BF":("Biologia","Fisiologia, saúde e microrganismos"),"BC":("Biologia","Citologia e bioquímica"),
 "ME":("Matemática","Geometria espacial"),"MP":("Matemática","Geometria plana e escalas"),"MA":("Matemática","Geometria analítica e trigonometria"),
 "MB":("Matemática","Probabilidade"),"MC":("Matemática","Análise combinatória"),"MS":("Matemática","Estatística e gráficos"),
 "MF":("Matemática","Funções e sequências"),"MR":("Matemática","Porcentagem, proporção e matemática financeira"),"MI":("Matemática","Aritmética e álgebra"),
}
if __name__=="__main__":
    import re
    Qs={q["id"]:q for q in carregar("data.js","[")}
    mp=os.path.join(ROOT,"build","classificacao_manual.json")
    man=json.load(open(mp)) if os.path.exists(mp) else {}
    ano=None; n=0
    for t in sys.argv[1].split():
        if re.fullmatch(r"\d\d",t): ano="20"+t; continue
        m=re.fullmatch(r"(\d+)([A-Z]+\d?)",t)
        assert m,t
        qid="%s-%03d"%(ano,int(m.group(1)))
        if qid not in Qs: qid=qid+"-en"
        assert qid in Qs,qid
        man[qid]=list(COD[m.group(2)]); n+=1
    json.dump(man,open(mp,"w"),ensure_ascii=False,indent=0)
    print("gravadas",n,"total",len(man))
