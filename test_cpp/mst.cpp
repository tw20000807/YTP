#include <bits/stdc++.h>
using namespace std;

struct Dsu{
    vector<int> p;
    int N;
    Dsu(int iN){
        N = iN;
        p.resize(N);
        for(int i = 0;i <= N;i++) p[i] = i;
    }
    int get(int x){
        if(p[x] == x) return p[x];
        p[x] = get(p[x]);
        return p[x];
    }
    bool merge(int a,int b){
        int pa = get(a),pb = get(b);
        if(pa == pb) return false;
        p[pa] = pb;
        return true;
    }
};
int main(){
    cin.tie(0);
    ios_base::sync_with_stdio(0);
    //start here
    int N = 5;
    vector<array<int,3>> edges{
        {1,1,2},
        {3,1,3},
        {5,1,4},
        {3,2,3},
        {2,3,4}
    };
    vector<array<int,3>> mst;
    Dsu dsu(N);
    sort(edges.begin(),edges.end());
    for(auto [w,u,v]:edges){
        if(dsu.merge(u,v)){
            mst.push_back({u,v,w});
        }
    }

}